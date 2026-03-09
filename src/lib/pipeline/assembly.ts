import { Playlist, type InsertableTrack } from "@/lib/db/repo";
import { findBestVideo } from "@/lib/services/youtube";
import type { PlaylistTrack } from "@/types";
import type { PendingTrack } from "@/lib/pipeline/types";

// ─── Track factories ──────────────────────────────────────────────────────────

export function makePendingTrack(
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

export function toInsertable(tracks: PendingTrack[]): InsertableTrack[] {
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

// ─── Pending slot resolution ──────────────────────────────────────────────────

/**
 * For every track that is still in "pending" state and has search_queries
 * (full-OST compilations and fallback tracks), attempt to find a YouTube video.
 * Updates the DB in-place and mutates the passed array so the caller's
 * in-memory state stays consistent.
 */
export async function resolvePendingSlots(inserted: PlaylistTrack[]): Promise<void> {
  const pendingTracks = inserted.filter((t) => t.status === "pending" && t.search_queries);
  const insertedIndexById = new Map(inserted.map((t, i) => [t.id, i]));

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
}
