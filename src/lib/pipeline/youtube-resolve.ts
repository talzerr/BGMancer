import { BackstageGames, VideoTracks } from "@/lib/db/repo";
import { searchOSTPlaylist, fetchVideoMetadata } from "@/lib/services/youtube";
import type { VideoMetadata } from "@/lib/services/youtube";
import type { Game } from "@/types";

/**
 * Discovers the YouTube OST playlist for a game.
 * Returns the cached playlist ID if available, otherwise searches YouTube and caches the result.
 */
export async function discoverOSTPlaylist(
  game: Game,
  onProgress?: (message: string) => void,
): Promise<string | null> {
  if (game.yt_playlist_id) {
    onProgress?.("Using cached OST playlist…");
    return game.yt_playlist_id;
  }

  onProgress?.("Searching YouTube for OST playlist…");
  const playlistId = await searchOSTPlaylist(game.title);
  if (playlistId) BackstageGames.setPlaylistId(game.id, playlistId);
  return playlistId;
}

/**
 * Fetches durations and view counts for any video IDs not yet in video_tracks,
 * stores them, and returns the full map.
 */
export async function ensureVideoMetadata(
  videoIds: string[],
  gameId: string,
): Promise<Map<string, { durationSeconds: number; viewCount: number | null }>> {
  const stored = VideoTracks.getByGame(gameId);
  // Fetch if duration is absent OR if view count hasn't been cached yet (e.g. tracks ingested
  // before view-count support was added, or tracks with Discogs durations that bypassed YouTube).
  const missing = videoIds.filter((id) => {
    const s = stored.get(id);
    return s?.durationSeconds == null || s?.viewCount == null;
  });

  const fetched: Map<string, VideoMetadata> =
    missing.length > 0 ? await fetchVideoMetadata(missing) : new Map();

  VideoTracks.storeDurations(
    missing.flatMap((id) => {
      const m = fetched.get(id);
      return m != null
        ? [{ videoId: id, gameId, durationSeconds: m.durationSeconds, viewCount: m.viewCount }]
        : [];
    }),
  );

  const result = new Map<string, { durationSeconds: number; viewCount: number | null }>();
  for (const [id, meta] of stored) {
    if (meta.durationSeconds != null) {
      result.set(id, { durationSeconds: meta.durationSeconds, viewCount: meta.viewCount });
    }
  }
  for (const [id, m] of fetched) {
    result.set(id, { durationSeconds: m.durationSeconds, viewCount: m.viewCount });
  }
  return result;
}
