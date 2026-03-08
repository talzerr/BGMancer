import { Games, Playlist, Config, YtPlaylists, type InsertableTrack } from "@/lib/db/repo";
import {
  selectTracksFromList,
  curatePlaylist,
  compilationQueries,
  type CandidateGroup,
} from "@/lib/services/llm";
import { getLLMProvider, getLocalLLMProvider } from "@/lib/llm";
import {
  searchOSTPlaylist,
  fetchPlaylistItems,
  fetchVideoDurations,
  findBestVideo,
  YouTubeQuotaError,
  type OSTTrack,
} from "@/lib/services/youtube";
import type { Game, PlaylistTrack } from "@/types";

export type GenerateEvent =
  | {
      type: "progress";
      gameId?: string;
      title?: string;
      status?: "active" | "done" | "error";
      message: string;
    }
  | { type: "done"; tracks: PlaylistTrack[]; count: number; found: number; pending: number }
  | { type: "error"; message: string; detail?: string };

type PendingTrack = Omit<PlaylistTrack, "position" | "created_at" | "synced_at">;

function makePendingTrack(
  gameId: string,
  gameTitle: string,
  overrides: Partial<PendingTrack> = {},
): PendingTrack {
  return {
    id: crypto.randomUUID(),
    game_id: gameId,
    game_title: gameTitle,
    track_name: null,
    video_id: null,
    video_title: null,
    channel_title: null,
    thumbnail: null,
    search_queries: null,
    duration_seconds: null,
    status: "pending",
    error_message: null,
    ...overrides,
  };
}

function toInsertable(tracks: PendingTrack[]): InsertableTrack[] {
  return tracks.map((t) => ({
    id: t.id,
    game_id: t.game_id,
    track_name: t.track_name,
    video_id: t.video_id,
    video_title: t.video_title,
    channel_title: t.channel_title,
    thumbnail: t.thumbnail,
    search_queries: t.search_queries,
    duration_seconds: t.duration_seconds,
    status: t.status,
    error_message: t.error_message,
  }));
}

// ─── Full-OST path (single compilation video per game) ───────────────────────

type GameTracks = { game: Game; tracks: PendingTrack[] };

async function generateTracksForFullOST(
  game: Game,
  send: (e: GenerateEvent) => void,
): Promise<GameTracks> {
  send({
    type: "progress",
    gameId: game.id,
    title: game.title,
    status: "active",
    message: "Finding full OST compilation…",
  });
  const queries = compilationQueries(game.title);
  send({
    type: "progress",
    gameId: game.id,
    title: game.title,
    status: "done",
    message: "Queued for YouTube search",
  });
  return {
    game,
    tracks: [makePendingTrack(game.id, game.title, { search_queries: queries })],
  };
}

// ─── Phase 1 + 2: playlist discovery then per-game candidate selection ───────

type CandidateResult =
  | { kind: "tracks"; game: Game; tracks: OSTTrack[] }
  | { kind: "fallback"; game: Game; pendingTracks: PendingTrack[] };

/**
 * Phases 1 & 2 for a single game:
 *   Phase 1 — Playlist discovery: finds (or loads from cache) the YouTube OST
 *             playlist ID for the game.
 *   Phase 2 — Track selection: asks the LLM to pick `candidateCount` quality
 *             candidates from the playlist, filtering junk and ensuring
 *             within-game variety.
 *
 */
async function fetchGameCandidates(
  game: Game,
  candidateCount: number,
  provider: ReturnType<typeof getLocalLLMProvider>,
  send: (e: GenerateEvent) => void,
): Promise<CandidateResult> {
  let playlistId = YtPlaylists.get(game.id);

  if (playlistId) {
    send({
      type: "progress",
      gameId: game.id,
      title: game.title,
      status: "active",
      message: "Using cached OST playlist…",
    });
  } else {
    send({
      type: "progress",
      gameId: game.id,
      title: game.title,
      status: "active",
      message: "Searching YouTube for OST playlist…",
    });
    playlistId = await searchOSTPlaylist(game.title);
    if (playlistId) YtPlaylists.upsert(game.id, playlistId);
  }

  if (!playlistId) {
    const queries = compilationQueries(game.title);
    send({
      type: "progress",
      gameId: game.id,
      title: game.title,
      status: "done",
      message: "No playlist found — queued for search",
    });
    return {
      kind: "fallback",
      game,
      pendingTracks: [
        makePendingTrack(game.id, game.title, {
          search_queries: queries,
          error_message: "No OST playlist found on YouTube — will search individually.",
        }),
      ],
    };
  }

  send({
    type: "progress",
    gameId: game.id,
    title: game.title,
    status: "active",
    message: "Fetching track list…",
  });
  const playlistTracks = await fetchPlaylistItems(playlistId);

  if (playlistTracks.length === 0) {
    send({
      type: "progress",
      gameId: game.id,
      title: game.title,
      status: "done",
      message: "No tracks found",
    });
    return { kind: "tracks", game, tracks: [] };
  }

  send({
    type: "progress",
    gameId: game.id,
    title: game.title,
    status: "active",
    message: `Selecting candidates from ${playlistTracks.length} tracks…`,
  });

  const selectedIndices = await selectTracksFromList(
    game.title,
    playlistTracks,
    Math.min(candidateCount, playlistTracks.length),
    provider,
  );

  const candidates = selectedIndices.map((idx) => playlistTracks[idx]);

  send({
    type: "progress",
    gameId: game.id,
    title: game.title,
    status: "done",
    message: `${candidates.length} candidates selected`,
  });

  return { kind: "tracks", game, tracks: candidates };
}

// ─── Background MB enrichment (fire-and-forget) ──────────────────────────────

// ─── Main generation pipeline ─────────────────────────────────────────────────

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

  // ── Full OST games (unchanged path) ──────────────────────────────────────
  const fullOSTResults: GameTracks[] = [];
  for (const game of fullOSTGames) {
    fullOSTResults.push(await generateTracksForFullOST(game, send));
  }

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
  let curatedTracks: PendingTrack[] = [];

  if (trackResults.length === 0) {
    // Nothing to curate — all games fell back
  } else if (trackResults.length === 1) {
    // Single game: skip Phase 2 (no cross-game curation needed)
    const { game, tracks } = trackResults[0];
    const sliced = tracks.slice(0, targetForIndividual);
    const durations = await fetchVideoDurations(sliced.map((t) => t.videoId));
    curatedTracks = sliced.map((t) =>
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
  } else {
    // Phase 3: hand off to the curator for cross-game ordering and final selection
    send({ type: "progress", message: "Curating playlist across all games…" });

    const groups: CandidateGroup[] = trackResults.map(({ game, tracks }) => ({
      gameTitle: game.title,
      tracks: tracks.map((t) => ({ videoId: t.videoId, title: t.title })),
    }));

    let orderedVideoIds: string[];
    try {
      orderedVideoIds = await curatePlaylist(groups, targetForIndividual, mainProvider);
    } catch (err) {
      // Phase 2 fallback: round-robin interleave
      console.warn("[generate] Phase 2 curation failed, falling back to interleave:", err);
      const usedIds = new Set<string>();
      orderedVideoIds = [];
      const maxLen = Math.max(...trackResults.map((r) => r.tracks.length));
      outer: for (let i = 0; i < maxLen; i++) {
        for (const { tracks } of trackResults) {
          if (i < tracks.length && !usedIds.has(tracks[i].videoId)) {
            usedIds.add(tracks[i].videoId);
            orderedVideoIds.push(tracks[i].videoId);
            if (orderedVideoIds.length >= targetForIndividual) break outer;
          }
        }
      }
    }

    // Build video → game+track lookup for final assembly
    const videoToResult = new Map<string, { game: Game; track: OSTTrack }>();
    for (const { game, tracks } of trackResults) {
      for (const t of tracks) videoToResult.set(t.videoId, { game, track: t });
    }

    const validVideoIds = orderedVideoIds.filter((vid) => videoToResult.has(vid));
    const durations = await fetchVideoDurations(validVideoIds);

    curatedTracks = validVideoIds.flatMap((vid) => {
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
  const insertedIndexById = new Map(inserted.map((t, i) => [t.id, i]));
  const pendingTracks = inserted.filter((t) => t.status === "pending" && t.search_queries);

  for (const track of pendingTracks) {
    try {
      const video = await findBestVideo(track.search_queries ?? [], false);
      if (video) {
        Playlist.setFound(
          track.id,
          video.videoId,
          video.title,
          video.channelTitle,
          video.thumbnail,
          video.durationSeconds,
        );
        const idx = insertedIndexById.get(track.id);
        if (idx !== undefined) {
          inserted[idx] = {
            ...inserted[idx],
            status: "found",
            video_id: video.videoId,
            video_title: video.title,
            channel_title: video.channelTitle,
            thumbnail: video.thumbnail,
            duration_seconds: video.durationSeconds,
          };
        }
      } else {
        Playlist.setError(track.id, "No suitable compilation video found.");
      }
    } catch {
      // Leave as pending — user can retry
    }
  }

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
