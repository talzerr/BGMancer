import { Games, Playlist, Users, Sessions } from "@/lib/db/repo";
import { GameProgressStatus, TrackStatus } from "@/types";
import { fetchVideoDurations, YouTubeQuotaError } from "@/lib/services/youtube";
import { fetchGameCandidates } from "@/lib/pipeline/candidates";
import {
  makePendingTrack,
  toInsertable,
  resolvePendingSlots,
  taggedTrackToPending,
} from "@/lib/pipeline/assembly";
import { assemblePlaylist } from "@/lib/pipeline/director";
import type { GenerateEvent, PendingTrack, CandidateResult } from "@/lib/pipeline/types";
import type { AppConfig, PlaylistTrack, TaggedTrack } from "@/types";
import {
  MIN_TRACK_DURATION_SECONDS,
  MAX_TRACK_DURATION_SECONDS,
  SESSION_NAME_MAX_GAMES,
  SESSION_NAME_MAX_LENGTH,
} from "@/lib/constants";

export type { GenerateEvent };

/**
 * Core playlist generation pipeline, decoupled from HTTP/SSE transport.
 *
 * Three-phase approach:
 *   Phase 1   — Playlist discovery: for each game, find (or load from cache)
 *               the YouTube OST playlist ID.
 *   Phase 1.5 — Track Resolution (TODO M7): map YouTube video IDs to canonical
 *               track names via video_tracks table; read real LLM tags from tracks table.
 *   Phase 2   — Vibe Profiler (TODO M9): LLM generates a ScoringRubric from
 *               session history and optional mood hint.
 *   Phase 3   — Deterministic arc assembly: the TypeScript Director builds the
 *               final ordered playlist, shaping energy flow and cross-game balance.
 *
 * Curation modes affect pipeline behaviour:
 *   skip    — excluded entirely (Games.listAll() already filters these out)
 *   lite    — phases 1/2; half-weighted budget in phase 3
 *   include — standard phases 1/2/3 (default)
 *   focus   — phases 1/2; guaranteed double-weighted budget in phase 3
 */
export async function generatePlaylist(
  send: (event: GenerateEvent) => void,
  userId: string,
  config: AppConfig,
): Promise<void> {
  const games = Games.listAll(userId);

  if (games.length === 0) {
    send({ type: "error", message: "Add at least one game before generating a playlist." });
    return;
  }

  const targetCount = config.target_track_count;
  const user = Users.getOrCreate(userId);

  // ── Phases 1 & 2: playlist discovery + per-game track tagging ─────────
  const candidateResults: CandidateResult[] = await Promise.all(
    games.map(async (game) => {
      try {
        return await fetchGameCandidates(game, send, userId, user.tier);
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

  const taggedResults = candidateResults.filter(
    (r): r is Extract<CandidateResult, { kind: "tagged" }> =>
      r.kind === "tagged" && r.tracks.length > 0,
  );
  const fallbackTracks = candidateResults
    .filter((r): r is Extract<CandidateResult, { kind: "fallback" }> => r.kind === "fallback")
    .flatMap((r) => r.pendingTracks);

  // ── Phase 3: deterministic arc assembly ───────────────────────────────
  const taggedPools = new Map<string, TaggedTrack[]>();
  for (const r of taggedResults) {
    taggedPools.set(r.game.id, r.tracks);
  }

  let individualTracks: PendingTrack[] = [];
  if (taggedPools.size > 0 && targetCount > 0) {
    const activeGames = games.filter((g) => taggedPools.has(g.id));

    send({ type: "progress", message: "Assembling playlist arc…" });
    // Request 15% extra so the duration filter has headroom without leaving gaps
    const assembleTarget = Math.ceil(targetCount * 1.15);
    const orderedTracks = assemblePlaylist(taggedPools, activeGames, assembleTarget);

    // Fetch durations for all selected tracks
    const durations = await fetchVideoDurations(orderedTracks.map((t) => t.videoId));
    individualTracks = orderedTracks.map((t) =>
      taggedTrackToPending(t, durations.get(t.videoId) ?? null),
    );
  }

  // ── Assemble final track list ─────────────────────────────────────────────
  const allTracks = [...individualTracks, ...fallbackTracks]
    .filter((t) => {
      if (t.duration_seconds == null) return true;
      if (!config.allow_short_tracks && t.duration_seconds < MIN_TRACK_DURATION_SECONDS)
        return false;
      if (!config.allow_long_tracks && t.duration_seconds > MAX_TRACK_DURATION_SECONDS)
        return false;
      return true;
    })
    .slice(0, targetCount);

  send({ type: "progress", message: "Saving playlist…" });
  const gameNames = [...new Set(allTracks.map((t) => t.game_title ?? t.game_id))];
  const rawNameList =
    gameNames.slice(0, SESSION_NAME_MAX_GAMES).join(", ") +
    (gameNames.length > SESSION_NAME_MAX_GAMES ? " and more" : "");
  const nameList =
    rawNameList.length > SESSION_NAME_MAX_LENGTH
      ? `${rawNameList.slice(0, SESSION_NAME_MAX_LENGTH - 1).trimEnd()}…`
      : rawNameList;
  const sessionName = nameList;
  const session = Sessions.create(user.id, sessionName);
  Playlist.replaceAll(session.id, toInsertable(allTracks));

  const inserted: PlaylistTrack[] = allTracks.map((t, position) => ({
    ...t,
    playlist_id: session.id,
    position,
    created_at: new Date().toISOString(),
    synced_at: null,
  }));

  // ── Resolve pending slots (fallback search queries) ───────────────────────
  await resolvePendingSlots(inserted, config.allow_long_tracks, config.allow_short_tracks);

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
