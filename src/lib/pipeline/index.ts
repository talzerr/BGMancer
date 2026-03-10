import { Games, Playlist, Users, Sessions, Config } from "@/lib/db/repo";
import { CurationMode, GameProgressStatus, TrackStatus } from "@/types";
import {
  getCandidatesProvider,
  getCurationProvider,
  getCleaningProvider,
  type LLMProvider,
} from "@/lib/llm";
import { fetchVideoDurations, YouTubeQuotaError } from "@/lib/services/youtube";
import { curatePlaylist, cleanTrackNames, type CandidateGroup } from "@/lib/services/curation";
import { generateTracksForFullOST, fetchGameCandidates } from "@/lib/pipeline/candidates";
import { makePendingTrack, toInsertable, resolvePendingSlots } from "@/lib/pipeline/assembly";
import type { GenerateEvent, PendingTrack, CandidateResult } from "@/lib/pipeline/types";
import type { OSTTrack } from "@/lib/services/youtube";
import type { Game, PlaylistTrack } from "@/types";
import {
  CANDIDATES_MAX,
  CANDIDATES_MIN,
  CANDIDATES_MULTIPLIER,
  MIN_TRACK_DURATION_SECONDS,
  MAX_TRACK_DURATION_SECONDS,
  SESSION_NAME_MAX_GAMES,
} from "@/lib/constants";

export type { GenerateEvent };

/**
 * Core playlist generation pipeline, decoupled from HTTP/SSE transport.
 *
 * Three-phase approach for individual-track games:
 *   Phase 1 — Playlist discovery: for each game, find (or load from cache)
 *             the YouTube OST playlist ID.
 *   Phase 2 — Per-game candidate selection: the candidates provider (Claude
 *             when available, else Ollama) picks candidates per game, filtering
 *             junk and ensuring within-game variety. Produces a candidate pool.
 *   Phase 3 — Global curation: the curation provider (Claude when available,
 *             else Ollama) builds the final ordered playlist across all pools —
 *             balancing cross-game variety, energy flow, and overall arc.
 *
 * Curation modes affect pipeline behaviour:
 *   skip    — excluded entirely (Games.listAll() already filters these out)
 *   lite    — phases 1/2 with half the candidate count; competes in phase 3
 *   include — standard phases 1/2/3 (default)
 *   focus   — phases 1/2 with exactly fair-share candidates; bypasses
 *             phase 3, gets guaranteed fair-share slots directly
 *
 * Full-OST games bypass all three phases (one compilation video per game).
 */
export async function generatePlaylist(send: (event: GenerateEvent) => void): Promise<void> {
  const games = Games.listAll(); // skip-mode games are already excluded

  if (games.length === 0) {
    send({ type: "error", message: "Add at least one game before generating a playlist." });
    return;
  }

  const config = Config.load();
  const targetCount = config.target_track_count;

  // Phase 2 (per-game candidates) and Phase 3 (global curation) use providers
  // determined by the user's tier — Maestro routes to Anthropic when a key is
  // available, Bard always uses local Ollama. Name cleaning always uses Ollama
  // (text processing only; no game knowledge needed, not worth burning quota).
  const user = Users.getOrCreateDefault();
  const candidatesProvider = getCandidatesProvider(user.tier);
  const curationProvider = getCurationProvider(user.tier);
  const cleaningProvider = getCleaningProvider();

  const fullOSTGames = games.filter((g) => g.allow_full_ost);
  const allIndividualGames = games.filter((g) => !g.allow_full_ost);
  const focusGames = allIndividualGames.filter((g) => g.curation === CurationMode.Focus);

  // ── Full OST games ────────────────────────────────────────────────────────
  const fullOSTResults = await Promise.all(
    fullOSTGames.map((game) => generateTracksForFullOST(game, send)),
  );

  // ── Phases 1 & 2: playlist discovery + per-game candidate selection ──────
  const targetForIndividual = Math.max(0, targetCount - fullOSTGames.length);
  const perGameFairShare =
    allIndividualGames.length > 0 ? Math.ceil(targetForIndividual / allIndividualGames.length) : 0;
  // 3× fair share per game as candidates, capped at 30 (prompt size / cost)
  const perGameCandidateTarget = Math.min(
    Math.max(perGameFairShare * CANDIDATES_MULTIPLIER, CANDIDATES_MIN),
    CANDIDATES_MAX,
  );

  // Focus games consume guaranteed slots; curation games (lite + include) share the rest.
  const focusSlots = focusGames.length * perGameFairShare;
  const curationSlots = Math.max(0, targetForIndividual - focusSlots);

  // Phases 1 & 2 run in parallel across all games — YouTube fetches and local
  // LLM calls are independent per game. If any game throws a quota error it
  // propagates immediately; other errors are caught per-game.
  // Candidate counts by mode:
  //   focus  — exactly perGameFairShare (bypasses phase 3, no extras needed)
  //   lite   — half of perGameCandidateTarget (fewer candidates → lower phase 3 representation)
  //   include — full perGameCandidateTarget
  const candidateResults: CandidateResult[] = await Promise.all(
    allIndividualGames.map(async (game) => {
      const candidateCount =
        game.curation === CurationMode.Focus
          ? perGameFairShare
          : game.curation === CurationMode.Lite
            ? Math.max(1, Math.round(perGameCandidateTarget * 0.5))
            : perGameCandidateTarget;
      try {
        return await fetchGameCandidates(game, candidateCount, candidatesProvider, send);
      } catch (err) {
        if (err instanceof YouTubeQuotaError) throw err;
        console.error(`[generate] Phases 1/2 failed for game "${game.title}":`, err);
        send({
          type: "progress",
          gameId: game.id,
          title: game.title,
          status: GameProgressStatus.Error,
          message: err instanceof Error ? err.message : "Failed",
        });
        return {
          kind: "fallback" as const,
          game,
          pendingTracks: [
            makePendingTrack(game.id, game.title, {
              status: TrackStatus.Error,
              error_message: err instanceof Error ? err.message : "Generation failed",
            }),
          ],
        };
      }
    }),
  );

  const focusTrackResults = candidateResults.filter(
    (r): r is Extract<CandidateResult, { kind: "tracks" }> =>
      r.kind === "tracks" && r.game.curation === CurationMode.Focus && r.tracks.length > 0,
  );
  const curationTrackResults = candidateResults.filter(
    (r): r is Extract<CandidateResult, { kind: "tracks" }> =>
      r.kind === "tracks" && r.game.curation !== CurationMode.Focus && r.tracks.length > 0,
  );
  const fallbackTracks = candidateResults
    .filter((r): r is Extract<CandidateResult, { kind: "fallback" }> => r.kind === "fallback")
    .flatMap((r) => r.pendingTracks);

  // ── Focus games: bypass curation, take guaranteed slots directly ──────────
  const focusedTracks = await resolveDirectTracks(focusTrackResults, perGameFairShare);

  // ── Phase 3: global cross-game curation (lite + include games) ───────────
  const curatedTracks = await runCurationPhase(
    curationTrackResults,
    curationSlots,
    curationProvider,
    send,
  );

  // ── Clean track display names ─────────────────────────────────────────────
  // Ask the local LLM to strip YouTube title noise. video_title is left as the
  // raw reference. Full-OST tracks (track_name = null) are skipped.
  const allIndividualTracks = [...focusedTracks, ...curatedTracks];
  const tracksToClean = allIndividualTracks.filter(
    (t) => t.video_title != null && t.track_name != null,
  );
  if (tracksToClean.length > 0) {
    send({ type: "progress", message: "Cleaning track names…" });
    const cleanedNames = await cleanTrackNames(
      tracksToClean.map((t) => ({
        id: t.id,
        gameTitle: t.game_title ?? "",
        videoTitle: t.video_title ?? "",
      })),
      cleaningProvider,
    );
    for (const track of allIndividualTracks) {
      const cleaned = cleanedNames.get(track.id);
      if (cleaned != null) track.track_name = cleaned;
    }
  }

  // ── Assemble final track list ─────────────────────────────────────────────
  // Focus tracks first (guaranteed), then curated, fallbacks, then full-OST compilations
  const fullOSTTracks = fullOSTResults.flatMap((r) => r.tracks);
  const allTracks = [
    ...focusedTracks,
    ...curatedTracks,
    ...fallbackTracks,
    ...fullOSTTracks,
  ].filter((t) => {
    if (t.duration_seconds == null) return true; // duration unknown — keep and let the player handle it
    if (t.duration_seconds < MIN_TRACK_DURATION_SECONDS) return false; // always drop short intros/stingers
    if (!config.allow_long_tracks && t.duration_seconds > MAX_TRACK_DURATION_SECONDS) return false;
    return true;
  });

  send({ type: "progress", message: "Saving playlist…" });
  const gameNames = [...new Set(allTracks.map((t) => t.game_title ?? t.game_id))];
  const nameList =
    gameNames.slice(0, SESSION_NAME_MAX_GAMES).join(", ") +
    (gameNames.length > SESSION_NAME_MAX_GAMES ? " and more" : "");
  const sessionName = `${new Date().toLocaleDateString()} – ${nameList}`;
  const session = Sessions.create(user.id, sessionName);
  Playlist.replaceAll(session.id, toInsertable(allTracks));

  const inserted: PlaylistTrack[] = allTracks.map((t, position) => ({
    ...t,
    playlist_id: session.id,
    position,
    created_at: new Date().toISOString(),
    synced_at: null,
  }));

  // ── Resolve pending slots (full-OST + fallback search queries) ────────────
  await resolvePendingSlots(inserted, config.allow_long_tracks);

  const foundCount = inserted.filter((t) => t.status === TrackStatus.Found).length;
  const pendingCount = inserted.filter((t) => t.status === TrackStatus.Pending).length;

  send({
    type: "done",
    sessionId: session.id,
    tracks: inserted,
    count: inserted.length,
    found: foundCount,
    pending: pendingCount,
  });
}

// ─── Focus game helper ────────────────────────────────────────────────────────

/** Converts focus-game candidate results directly to PendingTracks, bypassing phase 3. */
async function resolveDirectTracks(
  trackResults: Array<{ game: Game; tracks: OSTTrack[] }>,
  perGameCount: number,
): Promise<PendingTrack[]> {
  if (trackResults.length === 0) return [];
  const selected = trackResults.flatMap(({ game, tracks }) =>
    tracks.slice(0, perGameCount).map((t) => ({ game, track: t })),
  );
  const durations = await fetchVideoDurations(selected.map(({ track }) => track.videoId));
  return selected.map(({ game, track }) =>
    makePendingTrack(game.id, game.title, {
      track_name: track.title,
      video_id: track.videoId,
      video_title: track.title,
      channel_title: track.channelTitle,
      thumbnail: track.thumbnail,
      duration_seconds: durations.get(track.videoId) ?? null,
      status: TrackStatus.Found,
    }),
  );
}

// ─── Phase 3 helper ───────────────────────────────────────────────────────────

async function runCurationPhase(
  trackResults: Array<{ game: Game; tracks: OSTTrack[] }>,
  targetForIndividual: number,
  mainProvider: LLMProvider,
  send: (e: GenerateEvent) => void,
): Promise<PendingTrack[]> {
  if (trackResults.length === 0) return [];

  if (trackResults.length === 1) {
    // Single game: skip cross-game curation
    const { game, tracks } = trackResults[0];
    const sliced = tracks.slice(0, targetForIndividual);
    const durations = await fetchVideoDurations(sliced.map((t) => t.videoId));
    return sliced.map((t) =>
      makePendingTrack(game.id, game.title, {
        track_name: t.title,
        video_id: t.videoId,
        video_title: t.title,
        channel_title: t.channelTitle,
        thumbnail: t.thumbnail,
        duration_seconds: durations.get(t.videoId) ?? null,
        status: TrackStatus.Found,
      }),
    );
  }

  // Multi-game: hand off to the curator for cross-game ordering and final selection.
  // curatePlaylist handles its own round-robin fallback internally on LLM failure.
  send({ type: "progress", message: "Curating playlist across all games…" });

  const groups: CandidateGroup[] = trackResults.map(({ game, tracks }) => ({
    gameTitle: game.title,
    tracks: tracks.map((t) => ({ videoId: t.videoId, title: t.title })),
  }));

  const orderedVideoIds = await curatePlaylist(groups, targetForIndividual, mainProvider);

  const videoToResult = new Map<string, { game: Game; track: OSTTrack }>();
  for (const { game, tracks } of trackResults) {
    for (const t of tracks) videoToResult.set(t.videoId, { game, track: t });
  }

  const validVideoIds = orderedVideoIds.filter((vid) => videoToResult.has(vid));
  const durations = await fetchVideoDurations(validVideoIds);

  return validVideoIds.flatMap((vid) => {
    const entry = videoToResult.get(vid);
    if (!entry) return [];
    const { game, track } = entry;
    return [
      makePendingTrack(game.id, game.title, {
        track_name: track.title,
        video_id: track.videoId,
        video_title: track.title,
        channel_title: track.channelTitle,
        thumbnail: track.thumbnail,
        duration_seconds: durations.get(track.videoId) ?? null,
        status: TrackStatus.Found,
      }),
    ];
  });
}
