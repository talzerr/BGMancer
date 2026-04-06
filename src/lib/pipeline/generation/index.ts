import { createLogger } from "@/lib/logger";
import { Games, Playlist, Sessions, DirectorDecisions } from "@/lib/db/repo";
import { GameProgressStatus } from "@/types";
import type { CurationMode, TrackDecision } from "@/types";
import { fetchGameCandidates } from "@/lib/pipeline/generation/candidates";
import { toInsertable, taggedTrackToPending } from "@/lib/pipeline/generation/assembly";
import { assemblePlaylist } from "@/lib/pipeline/generation/director";
import {
  generateRubric,
  buildGameProfiles,
  findCachedRubric,
  type ProfilerResult,
} from "@/lib/pipeline/generation/vibe-profiler";
import { getVibeProfilerProvider } from "@/lib/llm";
import { acquireLlmGeneration } from "@/lib/rate-limit";
import type { GenerateEvent, PendingTrack } from "@/lib/pipeline/generation/types";
import type { AppConfig, Game, PlaylistTrack, TaggedTrack, VibeRubric } from "@/types";
import {
  MIN_TRACK_DURATION_SECONDS,
  MAX_TRACK_DURATION_SECONDS,
  SESSION_NAME_MAX_GAMES,
  SESSION_NAME_MAX_LENGTH,
} from "@/lib/constants";

const log = createLogger("generate");

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
      log.error("failed to load candidates", { gameTitle: game.title }, err);
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

async function profileVibe(
  activeGames: Game[],
  taggedPools: Map<string, TaggedTrack[]>,
  send: Send,
): Promise<ProfilerResult | undefined> {
  try {
    send({ type: "progress", message: "Generating vibe profile…" });
    const gameProfiles = buildGameProfiles(activeGames, taggedPools);
    const result = await generateRubric({ gameProfiles }, getVibeProfilerProvider());
    return result ?? undefined;
  } catch (err) {
    log.error("Vibe Profiler failed, continuing without rubric", {}, err);
    return undefined;
  }
}

function runDirector(
  taggedPools: Map<string, TaggedTrack[]>,
  activeGames: Game[],
  targetCount: number,
  rubric: VibeRubric | undefined,
  useViewBias: boolean,
): {
  pendingTracks: PendingTrack[];
  decisions: TrackDecision[];
  usedRubric?: VibeRubric;
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
  usedRubric?: VibeRubric,
  gameBudgets?: Record<string, number>,
  generatedName?: string | null,
): Promise<{ session: { id: string }; inserted: PlaylistTrack[] }> {
  let sessionName: string;
  if (generatedName) {
    sessionName = generatedName;
  } else {
    const gameNames = [...new Set(allTracks.map((t) => t.game_title ?? t.game_id))];
    const rawNameList =
      gameNames.slice(0, SESSION_NAME_MAX_GAMES).join(", ") +
      (gameNames.length > SESSION_NAME_MAX_GAMES ? " and more" : "");
    sessionName =
      rawNameList.length > SESSION_NAME_MAX_LENGTH
        ? `${rawNameList.slice(0, SESSION_NAME_MAX_LENGTH - 1).trimEnd()}…`
        : rawNameList;
  }

  const session = await Sessions.create(userId, sessionName);
  await Playlist.replaceAll(session.id, toInsertable(allTracks));

  if (decisions.length > 0 || usedRubric || gameBudgets) {
    try {
      await Sessions.updateTelemetry(session.id, usedRubric, gameBudgets);
      await DirectorDecisions.bulkInsert(session.id, decisions);
    } catch (err) {
      log.error("telemetry failed, session preserved", {}, err);
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
  gameSelections: Array<{ gameId: string; curation?: CurationMode }>,
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
    if (curation) {
      game.curation = curation;
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
  });
}

// ─── Authenticated pipeline ──────────────────────────────────────────────────

/**
 * Core playlist generation pipeline, decoupled from HTTP/SSE transport.
 *
 * Three phases (all track data is pre-cached during onboarding):
 *   1 — Candidate gathering: load tagged tracks + cached video metadata from DB.
 *   2 — Vibe Profiler: LLM produces a VibeRubric from game titles.
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
  let usedRubric: VibeRubric | undefined;
  let gameBudgets: Record<string, number> = {};
  let sessionName: string | null | undefined;

  if (filteredPools.size > 0 && targetCount > 0) {
    const activeGames = games.filter((g) => filteredPools.has(g.id));

    let profilerResult: ProfilerResult | undefined;
    if (!config.skip_llm) {
      // 1. Try cache first — no cap consumption, no LLM call
      const cached = await findCachedRubric(
        userId,
        activeGames.map((g) => g.id),
      );
      if (cached) {
        profilerResult = cached;
        send({ type: "progress", message: "Reusing vibe profile from previous session…" });
      } else {
        // 2. Cache miss — check AI cap
        const cap = await acquireLlmGeneration(userId);
        if (cap) {
          config.skip_llm = true;
          send({ type: "llm_cap_reached" });
        } else {
          // 3. Cap OK — run the profiler
          profilerResult = await profileVibe(activeGames, filteredPools, send);
        }
      }
    }

    send({ type: "progress", message: "Assembling playlist arc…" });
    const directorResult = runDirector(
      filteredPools,
      activeGames,
      targetCount,
      profilerResult?.rubric,
      !config.raw_vibes,
    );
    individualTracks = directorResult.pendingTracks;
    decisions = directorResult.decisions;
    usedRubric = directorResult.usedRubric;
    gameBudgets = directorResult.gameBudgets;
    sessionName = profilerResult?.sessionName;
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
    sessionName,
  );

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
  });
}
