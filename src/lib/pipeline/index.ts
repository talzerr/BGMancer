import { Games, Playlist, Users, Sessions, DirectorDecisions } from "@/lib/db/repo";
import { GameProgressStatus, TrackStatus, UserTier } from "@/types";
import type { TrackDecision } from "@/types";
import { YouTubeQuotaError } from "@/lib/services/youtube";
import { fetchGameCandidates } from "@/lib/pipeline/candidates";
import {
  makePendingTrack,
  toInsertable,
  resolvePendingSlots,
  taggedTrackToPending,
} from "@/lib/pipeline/assembly";
import { assemblePlaylist } from "@/lib/pipeline/director";
import { generateRubric } from "@/lib/pipeline/vibe-profiler";
import { getVibeProfilerProvider } from "@/lib/llm";
import type { GenerateEvent, PendingTrack, CandidateResult } from "@/lib/pipeline/types";
import type { AppConfig, Game, PlaylistTrack, TaggedTrack, ScoringRubric, User } from "@/types";
import {
  MIN_TRACK_DURATION_SECONDS,
  MAX_TRACK_DURATION_SECONDS,
  SESSION_NAME_MAX_GAMES,
  SESSION_NAME_MAX_LENGTH,
} from "@/lib/constants";

export type { GenerateEvent };

type Send = (event: GenerateEvent) => void;

// ─── Pipeline steps ───────────────────────────────────────────────────────────

async function gatherCandidates(
  games: Game[],
  user: User,
  send: Send,
): Promise<{ taggedPools: Map<string, TaggedTrack[]>; fallbackTracks: PendingTrack[] }> {
  const results: CandidateResult[] = await Promise.all(
    games.map(async (game) => {
      try {
        return await fetchGameCandidates(game, send, user.id, user.tier);
      } catch (err) {
        if (err instanceof YouTubeQuotaError) throw err;
        console.error(`[generate] Phases 1/1.5 failed for game "${game.title}":`, err);
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

  const taggedPools = new Map<string, TaggedTrack[]>();
  for (const r of results.filter(
    (r): r is Extract<CandidateResult, { kind: "tagged" }> =>
      r.kind === "tagged" && r.tracks.length > 0,
  )) {
    taggedPools.set(r.game.id, r.tracks);
  }

  const fallbackTracks = results
    .filter((r): r is Extract<CandidateResult, { kind: "fallback" }> => r.kind === "fallback")
    .flatMap((r) => r.pendingTracks);

  return { taggedPools, fallbackTracks };
}

function filterByDuration(
  taggedPools: Map<string, TaggedTrack[]>,
  config: AppConfig,
): Map<string, TaggedTrack[]> {
  if (config.allow_short_tracks && config.allow_long_tracks) return taggedPools;

  const filtered = new Map<string, TaggedTrack[]>();
  for (const [gameId, tracks] of taggedPools) {
    filtered.set(
      gameId,
      tracks.filter((t) => {
        if (!config.allow_short_tracks && t.durationSeconds < MIN_TRACK_DURATION_SECONDS)
          return false;
        if (!config.allow_long_tracks && t.durationSeconds > MAX_TRACK_DURATION_SECONDS)
          return false;
        return true;
      }),
    );
  }
  return filtered;
}

async function profileVibe(
  activeGames: Game[],
  user: User,
  send: Send,
): Promise<ScoringRubric | undefined> {
  if (user.tier !== UserTier.Maestro) return undefined;
  try {
    send({ type: "progress", message: "Generating vibe profile…" });
    const result = await generateRubric(
      { gameTitles: activeGames.map((g) => g.title) },
      getVibeProfilerProvider(user.tier),
    );
    return result ?? undefined;
  } catch (err) {
    console.error("[generate] Vibe Profiler failed, continuing without rubric:", err);
    return undefined;
  }
}

function runDirector(
  taggedPools: Map<string, TaggedTrack[]>,
  activeGames: Game[],
  targetCount: number,
  rubric: ScoringRubric | undefined,
): {
  pendingTracks: PendingTrack[];
  decisions: TrackDecision[];
  usedRubric?: ScoringRubric;
  gameBudgets: Record<string, number>;
} {
  const assembleTarget = Math.ceil(targetCount * 1.15);
  const result = assemblePlaylist(taggedPools, activeGames, assembleTarget, rubric);
  return {
    pendingTracks: result.tracks.map((t) => taggedTrackToPending(t, t.durationSeconds)),
    decisions: result.decisions,
    usedRubric: result.rubric,
    gameBudgets: result.gameBudgets,
  };
}

function persistSession(
  userId: string,
  allTracks: PendingTrack[],
  decisions: TrackDecision[],
  usedRubric?: ScoringRubric,
  gameBudgets?: Record<string, number>,
): { session: { id: string }; inserted: PlaylistTrack[] } {
  const gameNames = [...new Set(allTracks.map((t) => t.game_title ?? t.game_id))];
  const rawNameList =
    gameNames.slice(0, SESSION_NAME_MAX_GAMES).join(", ") +
    (gameNames.length > SESSION_NAME_MAX_GAMES ? " and more" : "");
  const sessionName =
    rawNameList.length > SESSION_NAME_MAX_LENGTH
      ? `${rawNameList.slice(0, SESSION_NAME_MAX_LENGTH - 1).trimEnd()}…`
      : rawNameList;

  const session = Sessions.create(userId, sessionName);
  Playlist.replaceAll(session.id, toInsertable(allTracks));

  if (decisions.length > 0 || usedRubric || gameBudgets) {
    try {
      Sessions.updateTelemetry(session.id, usedRubric, gameBudgets);
      DirectorDecisions.bulkInsert(session.id, decisions);
    } catch (err) {
      console.error("[persistSession] Telemetry failed, session preserved:", err);
    }
  }

  const inserted: PlaylistTrack[] = allTracks.map((t, position) => ({
    ...t,
    playlist_id: session.id,
    position,
    created_at: new Date().toISOString(),
    synced_at: null,
  }));

  return { session, inserted };
}

// ─── Pipeline orchestrator ────────────────────────────────────────────────────

/**
 * Core playlist generation pipeline, decoupled from HTTP/SSE transport.
 *
 * Four phases:
 *   1   — Playlist discovery: find (or search) the YouTube OST playlist per game.
 *   1.5 — Track resolution: align DB tags to video IDs; fetch and store durations.
 *   2   — Vibe Profiler (Maestro only): LLM produces a ScoringRubric from game titles.
 *   3   — Arc assembly: the Director builds the final ordered playlist.
 */
export async function generatePlaylist(
  send: Send,
  userId: string,
  config: AppConfig,
): Promise<void> {
  const games = Games.listAll(userId);
  if (games.length === 0) {
    send({ type: "error", message: "Add at least one game before generating a playlist." });
    return;
  }

  const user = Users.getOrCreate(userId);
  const targetCount = config.target_track_count;

  const { taggedPools, fallbackTracks } = await gatherCandidates(games, user, send);
  const filteredPools = filterByDuration(taggedPools, config);

  let individualTracks: PendingTrack[] = [];
  let decisions: TrackDecision[] = [];
  let usedRubric: ScoringRubric | undefined;
  let gameBudgets: Record<string, number> = {};

  if (filteredPools.size > 0 && targetCount > 0) {
    const activeGames = games.filter((g) => filteredPools.has(g.id));
    const rubric = await profileVibe(activeGames, user, send);
    send({ type: "progress", message: "Assembling playlist arc…" });
    const directorResult = runDirector(filteredPools, activeGames, targetCount, rubric);
    individualTracks = directorResult.pendingTracks;
    decisions = directorResult.decisions;
    usedRubric = directorResult.usedRubric;
    gameBudgets = directorResult.gameBudgets;
  }

  const allTracks = [...individualTracks, ...fallbackTracks].slice(0, targetCount);

  // Decisions are indexed by arc slot position. After slicing tracks to targetCount,
  // only keep decisions for positions that survived the cut.
  const slicedDecisions = decisions.filter((d) => d.position < allTracks.length);

  send({ type: "progress", message: "Saving playlist…" });
  const { session, inserted } = persistSession(
    user.id,
    allTracks,
    slicedDecisions,
    usedRubric,
    gameBudgets,
  );

  await resolvePendingSlots(inserted, config.allow_long_tracks, config.allow_short_tracks);

  send({
    type: "done",
    sessionId: session.id,
    tracks: inserted,
    count: inserted.length,
    found: inserted.filter((t) => t.status === TrackStatus.Found).length,
    pending: inserted.filter((t) => t.status === TrackStatus.Pending).length,
  });
}
