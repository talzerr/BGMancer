import { Games, Playlist, Config } from "@/lib/db/repo";
import { getLLMProvider, getLocalLLMProvider } from "@/lib/llm";
import { fetchVideoDurations, YouTubeQuotaError } from "@/lib/services/youtube";
import { curatePlaylist, cleanTrackNames, type CandidateGroup } from "@/lib/services/curation";
import { generateTracksForFullOST, fetchGameCandidates } from "@/lib/pipeline/candidates";
import { makePendingTrack, toInsertable, resolvePendingSlots } from "@/lib/pipeline/assembly";
import type { GenerateEvent, PendingTrack, CandidateResult } from "@/lib/pipeline/types";
import type { OSTTrack } from "@/lib/services/youtube";
import type { Game, PlaylistTrack } from "@/types";

export type { GenerateEvent };

/**
 * Core playlist generation pipeline, decoupled from HTTP/SSE transport.
 *
 * Three-phase approach for individual-track games:
 *   Phase 1 — Playlist discovery: for each game, find (or load from cache)
 *             the YouTube OST playlist ID.
 *   Phase 2 — Per-game track selection: LLM picks 3× the fair-share count
 *             from each game's playlist, filtering junk and ensuring variety
 *             within the game. Produces a candidate pool per game.
 *   Phase 3 — Global curation: a single LLM call across all candidate pools
 *             builds the final ordered playlist — balancing cross-game variety,
 *             energy flow, and overall arc from start to end.
 *
 * Full-OST games bypass all three phases (one compilation video per game).
 */
export async function generatePlaylist(send: (event: GenerateEvent) => void): Promise<void> {
  const games = Games.listAll();

  if (games.length === 0) {
    send({ type: "error", message: "Add at least one game before generating a playlist." });
    return;
  }

  const config = Config.load();
  const targetCount = config.target_track_count;

  // Phase 2 uses a local model (Ollama) — no game knowledge required, just
  // junk filtering and within-game variety. Phase 3 uses the primary provider
  // (Claude) where game knowledge matters for cross-game curation.
  const localProvider = getLocalLLMProvider();
  const mainProvider = getLLMProvider();

  const fullOSTGames = games.filter((g) => g.allow_full_ost);
  const individualGames = games.filter((g) => !g.allow_full_ost);

  // ── Full OST games ────────────────────────────────────────────────────────
  const fullOSTResults = await Promise.all(
    fullOSTGames.map((game) => generateTracksForFullOST(game, send)),
  );

  // ── Phases 1 & 2: playlist discovery + per-game candidate selection ──────
  const targetForIndividual = Math.max(0, targetCount - fullOSTGames.length);
  const perGameFairShare =
    individualGames.length > 0 ? Math.ceil(targetForIndividual / individualGames.length) : 0;
  // 3× fair share per game as candidates, capped at 30 (prompt size / cost)
  const perGameCandidateTarget = Math.min(Math.max(perGameFairShare * 3, 5), 30);

  // Phases 1 & 2 run in parallel across all games — YouTube fetches and local
  // LLM calls are independent per game. If any game throws a quota error it
  // propagates immediately; other errors are caught per-game.
  const candidateResults: CandidateResult[] = await Promise.all(
    individualGames.map(async (game) => {
      try {
        return await fetchGameCandidates(game, perGameCandidateTarget, localProvider, send);
      } catch (err) {
        if (err instanceof YouTubeQuotaError) throw err;
        console.error(`[generate] Phases 1/2 failed for game "${game.title}":`, err);
        send({
          type: "progress",
          gameId: game.id,
          title: game.title,
          status: "error",
          message: err instanceof Error ? err.message : "Failed",
        });
        return {
          kind: "fallback" as const,
          game,
          pendingTracks: [
            makePendingTrack(game.id, game.title, {
              status: "error",
              error_message: err instanceof Error ? err.message : "Generation failed",
            }),
          ],
        };
      }
    }),
  );

  const trackResults = candidateResults.filter(
    (r): r is Extract<CandidateResult, { kind: "tracks" }> =>
      r.kind === "tracks" && r.tracks.length > 0,
  );
  const fallbackTracks = candidateResults
    .filter((r): r is Extract<CandidateResult, { kind: "fallback" }> => r.kind === "fallback")
    .flatMap((r) => r.pendingTracks);

  // ── Phase 3: global cross-game curation ──────────────────────────────────
  const curatedTracks = await runCurationPhase(
    trackResults,
    targetForIndividual,
    mainProvider,
    send,
  );

  // ── Clean track display names ─────────────────────────────────────────────
  // Ask the local LLM to strip YouTube title noise. video_title is left as the
  // raw reference. Full-OST tracks (track_name = null) are skipped.
  const tracksToClean = curatedTracks.filter((t) => t.video_title != null && t.track_name != null);
  if (tracksToClean.length > 0) {
    send({ type: "progress", message: "Cleaning track names…" });
    const cleanedNames = await cleanTrackNames(
      tracksToClean.map((t) => ({
        id: t.id,
        gameTitle: t.game_title ?? "",
        videoTitle: t.video_title ?? "",
      })),
      localProvider,
    );
    for (const track of curatedTracks) {
      const cleaned = cleanedNames.get(track.id);
      if (cleaned != null) track.track_name = cleaned;
    }
  }

  // ── Assemble final track list ─────────────────────────────────────────────
  // Curated individual tracks first (in curator order), then full-OST compilations
  const fullOSTTracks = fullOSTResults.flatMap((r) => r.tracks);
  const allTracks = [...curatedTracks, ...fallbackTracks, ...fullOSTTracks];

  send({ type: "progress", message: "Saving playlist…" });
  Playlist.replaceAll(toInsertable(allTracks));

  const inserted: PlaylistTrack[] = allTracks.map((t, position) => ({
    ...t,
    position,
    created_at: new Date().toISOString(),
    synced_at: null,
  }));

  // ── Resolve pending slots (full-OST + fallback search queries) ────────────
  await resolvePendingSlots(inserted);

  const foundCount = inserted.filter((t) => t.status === "found").length;
  const pendingCount = inserted.filter((t) => t.status === "pending").length;

  send({
    type: "done",
    tracks: inserted,
    count: inserted.length,
    found: foundCount,
    pending: pendingCount,
  });
}

// ─── Phase 3 helper ───────────────────────────────────────────────────────────

async function runCurationPhase(
  trackResults: Array<{ game: Game; tracks: OSTTrack[] }>,
  targetForIndividual: number,
  mainProvider: ReturnType<typeof getLLMProvider>,
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
        status: "found",
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
        status: "found",
      }),
    ];
  });
}
