import { Games, Playlist, Config, YtPlaylists, type InsertableTrack } from "@/lib/db/repo";
import { selectTracksFromList, compilationQueries } from "@/lib/services/llm";
import {
  searchOSTPlaylist,
  fetchPlaylistItems,
  fetchVideoDurations,
  findBestVideo,
  YouTubeQuotaError,
} from "@/lib/services/youtube";
import type { Game, PlaylistTrack, VibePreference } from "@/types";

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

type GameTracks = {
  game: Game;
  tracks: PendingTrack[];
};

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

async function generateTracksForFullOST(
  game: Game,
  vibe: VibePreference,
  send: (e: GenerateEvent) => void,
): Promise<GameTracks> {
  send({
    type: "progress",
    gameId: game.id,
    title: game.title,
    status: "active",
    message: "Finding full OST compilation…",
  });
  const queries = compilationQueries(game.title, vibe);
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

async function generateTracksForIndividual(
  game: Game,
  count: number,
  vibe: VibePreference,
  send: (e: GenerateEvent) => void,
): Promise<GameTracks> {
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
    const queries = compilationQueries(game.title, vibe);
    send({
      type: "progress",
      gameId: game.id,
      title: game.title,
      status: "done",
      message: "No playlist found — queued for search",
    });
    return {
      game,
      tracks: Array.from({ length: count }, () =>
        makePendingTrack(game.id, game.title, {
          search_queries: queries,
          error_message: "No OST playlist found on YouTube — will search individually.",
        }),
      ),
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
    return { game, tracks: [] };
  }

  send({
    type: "progress",
    gameId: game.id,
    title: game.title,
    status: "active",
    message: `AI selecting ${count} from ${playlistTracks.length} tracks…`,
  });
  const selectedIndices = await selectTracksFromList(
    game.title,
    vibe,
    playlistTracks,
    Math.min(count, playlistTracks.length),
  );

  send({
    type: "progress",
    gameId: game.id,
    title: game.title,
    status: "done",
    message: `${selectedIndices.length} tracks selected`,
  });

  const selectedTracks = selectedIndices.map((idx) => playlistTracks[idx]);
  const durations = await fetchVideoDurations(selectedTracks.map((t) => t.videoId));

  return {
    game,
    tracks: selectedTracks.map((t) =>
      makePendingTrack(game.id, game.title, {
        track_name: t.title,
        video_id: t.videoId,
        video_title: t.title,
        channel_title: t.channelTitle,
        thumbnail: t.thumbnail,
        duration_seconds: durations.get(t.videoId) ?? null,
        search_queries: null,
        status: "found",
      }),
    ),
  };
}

function interleave(perGame: GameTracks[]): PendingTrack[] {
  const columns = perGame.map((g) => g.tracks);
  const result: PendingTrack[] = [];
  const maxLen = Math.max(...columns.map((c) => c.length), 0);

  for (let i = 0; i < maxLen; i++) {
    for (const col of columns) {
      if (i < col.length) result.push(col[i]);
    }
  }
  return result;
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

/**
 * Core playlist generation pipeline, decoupled from HTTP/SSE transport.
 * Calls `send` with progress events; returns the final track list.
 */
export async function generatePlaylist(send: (event: GenerateEvent) => void): Promise<void> {
  const games = Games.listAll();

  if (games.length === 0) {
    send({ type: "error", message: "Add at least one game before generating a playlist." });
    return;
  }

  const config = Config.load();
  const targetCount = config.target_track_count;
  const vibe: VibePreference = config.vibe;

  const fullOSTGames = games.filter((g) => g.allow_full_ost);
  const individualGames = games.filter((g) => !g.allow_full_ost);

  const remainingSlots = Math.max(0, targetCount - fullOSTGames.length);
  const tracksPerGame =
    individualGames.length > 0
      ? Math.max(1, Math.floor(remainingSlots / individualGames.length))
      : 0;
  const remainder = individualGames.length > 0 ? remainingSlots % individualGames.length : 0;

  // Pre-build index map to avoid O(n²) indexOf inside the loop.
  const individualGameIndex = new Map(individualGames.map((g, i) => [g.id, i]));

  const perGame: GameTracks[] = [];

  for (const game of games) {
    if (game.allow_full_ost) {
      perGame.push(await generateTracksForFullOST(game, vibe, send));
      continue;
    }

    const individualIdx = individualGameIndex.get(game.id) ?? 0;
    const count = tracksPerGame + (individualIdx < remainder ? 1 : 0);

    try {
      perGame.push(await generateTracksForIndividual(game, count, vibe, send));
    } catch (err) {
      if (err instanceof YouTubeQuotaError) throw err;

      console.error(`[generate] failed for game "${game.title}":`, err);
      perGame.push({
        game,
        tracks: [
          makePendingTrack(game.id, game.title, {
            status: "error",
            error_message: err instanceof Error ? err.message : "Generation failed",
          }),
        ],
      });
      send({
        type: "progress",
        gameId: game.id,
        title: game.title,
        status: "error",
        message: err instanceof Error ? err.message : "Failed",
      });
    }
  }

  // ── Interleave & persist ──────────────────────────────────────────────

  const interleaved = interleave(perGame);

  send({ type: "progress", message: "Saving playlist…" });

  Playlist.replaceAll(toInsertable(interleaved));

  const inserted: PlaylistTrack[] = interleaved.map((t, position) => ({
    ...t,
    position,
    created_at: new Date().toISOString(),
    synced_at: null,
  }));

  // ── Resolve full-OST pending slots ────────────────────────────────────

  // Pre-build id→index map to avoid O(n²) findIndex inside the loop.
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
      // Leave as pending — user can retry via /search
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
