import { Games, Tracks } from "@/lib/db/repo";
import { compilationQueries } from "@/lib/pipeline/assembly";
import { searchOSTPlaylist, fetchPlaylistItems } from "@/lib/services/youtube";
import { type Game, type TaggedTrack, type UserTier, GameProgressStatus, TrackRole } from "@/types";
import { makePendingTrack } from "@/lib/pipeline/assembly";
import type { GenerateEvent, CandidateResult } from "@/lib/pipeline/types";
import { resolveTracksToVideos } from "@/lib/pipeline/resolver";
import { getTaggingProvider } from "@/lib/llm";

// ─── Phase 1 + 2: playlist discovery then per-game tagging ──────────────────

/**
 * Phases 1 & 2 for a single game:
 *   Phase 1 — Playlist discovery: finds (or loads from cache) the YouTube OST
 *             playlist ID for the game.
 *   Phase 2 — Track tagging: asks the LLM to tag all tracks with metadata
 *             (energy, role, cleanName, isJunk). Junk tracks are filtered out.
 */
export async function fetchGameCandidates(
  game: Game,
  send: (e: GenerateEvent) => void,
  _userId: string,
  tier: UserTier,
): Promise<CandidateResult> {
  let playlistId = game.yt_playlist_id;

  if (playlistId) {
    send({
      type: "progress",
      gameId: game.id,
      title: game.title,
      status: GameProgressStatus.Active,
      message: "Using cached OST playlist…",
    });
  } else {
    send({
      type: "progress",
      gameId: game.id,
      title: game.title,
      status: GameProgressStatus.Active,
      message: "Searching YouTube for OST playlist…",
    });
    playlistId = await searchOSTPlaylist(game.title);
    if (playlistId) Games.setPlaylistId(game.id, playlistId);
  }

  if (!playlistId) {
    const queries = compilationQueries(game.title);
    send({
      type: "progress",
      gameId: game.id,
      title: game.title,
      status: GameProgressStatus.Done,
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
    status: GameProgressStatus.Active,
    message: "Fetching track list…",
  });
  const playlistTracks = await fetchPlaylistItems(playlistId);

  if (playlistTracks.length === 0) {
    send({
      type: "progress",
      gameId: game.id,
      title: game.title,
      status: GameProgressStatus.Done,
      message: "No tracks found",
    });
    return { kind: "tagged", game, tracks: [] };
  }

  if (Tracks.hasData(game.id)) {
    const allTracks = Tracks.getByGame(game.id);
    const activeTracks = allTracks.filter((t) => t.active);

    if (activeTracks.length === 0) {
      send({
        type: "progress",
        gameId: game.id,
        title: game.title,
        status: GameProgressStatus.Done,
        message: "No active tracks",
      });
      return { kind: "tagged", game, tracks: [] };
    }

    send({
      type: "progress",
      gameId: game.id,
      title: game.title,
      status: GameProgressStatus.Active,
      message: "Resolving tracks to videos…",
    });

    const provider = getTaggingProvider(tier);
    const resolved = await resolveTracksToVideos(game, allTracks, playlistTracks, provider);

    const taggedTracks: TaggedTrack[] = resolved
      .filter(
        (
          r,
        ): r is typeof r & {
          energy: NonNullable<typeof r.energy>;
          role: NonNullable<typeof r.role>;
        } => r.energy !== null && r.role !== null,
      )
      .map((r) => ({
        videoId: r.videoId,
        title: r.videoTitle,
        channelTitle: r.channelTitle,
        thumbnail: r.thumbnail,
        gameId: game.id,
        gameTitle: game.title,
        cleanName: r.trackName,
        energy: r.energy,
        role: r.role,
        isJunk: false,
        moods: r.moods,
        instrumentation: r.instrumentation,
        hasVocals: r.hasVocals ?? false,
      }));

    send({
      type: "progress",
      gameId: game.id,
      title: game.title,
      status: GameProgressStatus.Done,
      message: `${taggedTracks.length} tracks resolved`,
    });

    return { kind: "tagged", game, tracks: taggedTracks };
  }

  // Legacy path — no curated track data for this game
  send({
    type: "progress",
    gameId: game.id,
    title: game.title,
    status: GameProgressStatus.Active,
    message: "Legacy path — limited quality",
  });

  const taggedTracks: TaggedTrack[] = playlistTracks.map((t) => ({
    videoId: t.videoId,
    title: t.title,
    channelTitle: t.channelTitle,
    thumbnail: t.thumbnail,
    gameId: game.id,
    gameTitle: game.title,
    cleanName: t.title,
    energy: 2,
    role: TrackRole.Ambient,
    isJunk: false,
    moods: [],
    instrumentation: [],
    hasVocals: false,
  }));

  send({
    type: "progress",
    gameId: game.id,
    title: game.title,
    status: GameProgressStatus.Done,
    message: `${taggedTracks.length} tracks queued (limited quality)`,
  });

  return { kind: "tagged", game, tracks: taggedTracks };
}
