import { Games, Playlist, Sessions, DirectorDecisions } from "@/lib/db/repo";
import { CurationMode, GameProgressStatus, TrackStatus } from "@/types";
import type { TrackDecision } from "@/types";
import { fetchGameCandidates } from "@/lib/pipeline/candidates";
import { toInsertable, resolvePendingSlots, taggedTrackToPending } from "@/lib/pipeline/assembly";
import { assemblePlaylist } from "@/lib/pipeline/director";
import { generateRubric } from "@/lib/pipeline/vibe-profiler";
import { getVibeProfilerProvider } from "@/lib/llm";
import type { GenerateEvent, PendingTrack } from "@/lib/pipeline/types";
import type { AppConfig, Game, PlaylistTrack, TaggedTrack, ScoringRubric } from "@/types";
import {
  MIN_TRACK_DURATION_SECONDS,
  MAX_TRACK_DURATION_SECONDS,
  SESSION_NAME_MAX_GAMES,
  SESSION_NAME_MAX_LENGTH,
} from "@/lib/constants";

export type { GenerateEvent };

type Send = (event: GenerateEvent) => void;

// ─── Pipeline steps ───────────────────────────────────────────────────────────

async function gatherCandidates(games: Game[], send: Send): Promise<Map<string, TaggedTrack[]>> {
  const taggedPools = new Map<string, TaggedTrack[]>();

  for (const game of games) {
    try {
      const tracks = await fetchGameCandidates(game, send);
      if (tracks.length > 0) taggedPools.set(game.id, tracks);
    } catch (err) {
      console.error(`[generate] Failed to load candidates for "${game.title}":`, err);
      send({
        type: "progress",
        gameId: game.id,
        title: game.title,
        status: GameProgressStatus.Error,
        message: err instanceof Error ? err.message : "Failed",
      });
    }
  }

  return taggedPools;
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

async function profileVibe(activeGames: Game[], send: Send): Promise<ScoringRubric | undefined> {
  try {
    send({ type: "progress", message: "Generating vibe profile…" });
    const result = await generateRubric(
      { gameTitles: activeGames.map((g) => g.title) },
      getVibeProfilerProvider(),
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
  useViewBias: boolean,
): {
  pendingTracks: PendingTrack[];
  decisions: TrackDecision[];
  usedRubric?: ScoringRubric;
  gameBudgets: Record<string, number>;
} {
  const assembleTarget = Math.ceil(targetCount * 1.15);
  const result = assemblePlaylist(taggedPools, activeGames, assembleTarget, rubric, useViewBias);
  return {
    pendingTracks: result.tracks.map((t) => taggedTrackToPending(t, t.durationSeconds)),
    decisions: result.decisions,
    usedRubric: result.rubric,
    gameBudgets: result.gameBudgets,
  };
}

async function persistSession(
  userId: string,
  allTracks: PendingTrack[],
  decisions: TrackDecision[],
  usedRubric?: ScoringRubric,
  gameBudgets?: Record<string, number>,
): Promise<{ session: { id: string }; inserted: PlaylistTrack[] }> {
  const gameNames = [...new Set(allTracks.map((t) => t.game_title ?? t.game_id))];
  const rawNameList =
    gameNames.slice(0, SESSION_NAME_MAX_GAMES).join(", ") +
    (gameNames.length > SESSION_NAME_MAX_GAMES ? " and more" : "");
  const sessionName =
    rawNameList.length > SESSION_NAME_MAX_LENGTH
      ? `${rawNameList.slice(0, SESSION_NAME_MAX_LENGTH - 1).trimEnd()}…`
      : rawNameList;

  const session = await Sessions.create(userId, sessionName);
  await Playlist.replaceAll(session.id, toInsertable(allTracks));

  if (decisions.length > 0 || usedRubric || gameBudgets) {
    try {
      await Sessions.updateTelemetry(session.id, usedRubric, gameBudgets);
      await DirectorDecisions.bulkInsert(session.id, decisions);
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

// ─── Guest pipeline ──────────────────────────────────────────────────────────

/**
 * Guest generation: Director-only (no Vibe Profiler), no persistence.
 * Games are loaded by IDs from the published catalog, not from a user library.
 * Curation modes can be overridden via the gameSelections parameter.
 */
export async function generatePlaylistForGuest(
  send: Send,
  gameSelections: Array<{ gameId: string; curation?: string }>,
  config: AppConfig,
): Promise<void> {
  const gameIds = gameSelections.map((s) => s.gameId);
  const games = await Games.getPublishedByIds(gameIds);

  if (games.length === 0) {
    send({
      type: "error",
      message: "No valid games selected. Browse the Catalog to pick some.",
    });
    return;
  }

  // Apply curation overrides from the request
  const curationMap = new Map(gameSelections.map((s) => [s.gameId, s.curation]));
  for (const game of games) {
    const curation = curationMap.get(game.id);
    if (curation && Object.values(CurationMode).includes(curation as CurationMode)) {
      game.curation = curation as CurationMode;
    }
  }

  const targetCount = config.target_track_count;
  const taggedPools = await gatherCandidates(games, send);
  const filteredPools = filterByDuration(taggedPools, config);

  let tracks: PendingTrack[] = [];

  if (filteredPools.size > 0 && targetCount > 0) {
    const activeGames = games.filter((g) => filteredPools.has(g.id));
    send({ type: "progress", message: "Assembling playlist arc…" });
    const directorResult = runDirector(filteredPools, activeGames, targetCount, undefined, false);
    tracks = directorResult.pendingTracks;
  }

  const allTracks = tracks.slice(0, targetCount);

  // Enrich with game thumbnails
  const gameMap = new Map(games.map((g) => [g.id, g]));
  const finalTracks: PlaylistTrack[] = allTracks.map((t, position) => {
    const g = gameMap.get(t.game_id);
    return {
      ...t,
      playlist_id: "guest",
      position,
      created_at: new Date().toISOString(),
      synced_at: null,
      ...(g ? { game_thumbnail_url: g.thumbnail_url } : {}),
    };
  });

  send({
    type: "done",
    tracks: finalTracks,
    count: finalTracks.length,
    found: finalTracks.filter((t) => t.status === TrackStatus.Found).length,
    pending: finalTracks.filter((t) => t.status === TrackStatus.Pending).length,
  });
}

// ─── Authenticated pipeline ──────────────────────────────────────────────────

/**
 * Core playlist generation pipeline, decoupled from HTTP/SSE transport.
 *
 * Three phases (all track data is pre-cached during onboarding):
 *   1 — Candidate gathering: load tagged tracks + cached video metadata from DB.
 *   2 — Vibe Profiler: LLM produces a ScoringRubric from game titles.
 *   3 — Arc assembly: the Director builds the final ordered playlist.
 */
export async function generatePlaylist(
  send: Send,
  userId: string,
  config: AppConfig,
): Promise<void> {
  const games = await Games.listAll(userId);
  if (games.length === 0) {
    send({
      type: "error",
      message: "No games in your library. Browse the Catalog to add some.",
    });
    return;
  }

  const targetCount = config.target_track_count;

  const taggedPools = await gatherCandidates(games, send);
  const filteredPools = filterByDuration(taggedPools, config);

  let individualTracks: PendingTrack[] = [];
  let decisions: TrackDecision[] = [];
  let usedRubric: ScoringRubric | undefined;
  let gameBudgets: Record<string, number> = {};

  if (filteredPools.size > 0 && targetCount > 0) {
    const activeGames = games.filter((g) => filteredPools.has(g.id));
    const rubric = await profileVibe(activeGames, send);
    send({ type: "progress", message: "Assembling playlist arc…" });
    const directorResult = runDirector(
      filteredPools,
      activeGames,
      targetCount,
      rubric,
      !config.raw_vibes,
    );
    individualTracks = directorResult.pendingTracks;
    decisions = directorResult.decisions;
    usedRubric = directorResult.usedRubric;
    gameBudgets = directorResult.gameBudgets;
  }

  const allTracks = individualTracks.slice(0, targetCount);

  // Decisions are indexed by arc slot position. After slicing tracks to targetCount,
  // only keep decisions for positions that survived the cut.
  const slicedDecisions = decisions.filter((d) => d.position < allTracks.length);

  send({ type: "progress", message: "Saving playlist…" });
  const { session, inserted } = await persistSession(
    userId,
    allTracks,
    slicedDecisions,
    usedRubric,
    gameBudgets,
  );

  await resolvePendingSlots(inserted, config.allow_long_tracks, config.allow_short_tracks);

  // Enrich with JOIN-derived fields from the games already in memory.
  const gameMap = new Map(games.map((g) => [g.id, g]));
  const finalTracks = inserted.map((t) => {
    const g = gameMap.get(t.game_id);
    return g ? { ...t, game_thumbnail_url: g.thumbnail_url } : t;
  });

  send({
    type: "done",
    sessionId: session.id,
    tracks: finalTracks,
    count: finalTracks.length,
    found: finalTracks.filter((t) => t.status === TrackStatus.Found).length,
    pending: finalTracks.filter((t) => t.status === TrackStatus.Pending).length,
  });
}
