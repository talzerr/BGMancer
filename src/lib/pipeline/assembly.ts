import { Playlist, type InsertableTrack } from "@/lib/db/repo";
import { findBestVideo, YouTubeQuotaError } from "@/lib/services/youtube";
import { newId } from "@/lib/uuid";
import { TrackStatus } from "@/types";
import type { PlaylistTrack, TaggedTrack } from "@/types";
import type { PendingTrack } from "@/lib/pipeline/types";
import { MIN_TRACK_DURATION_SECONDS, MAX_TRACK_DURATION_SECONDS } from "@/lib/constants";

// ─── Track factories ──────────────────────────────────────────────────────────

export function makePendingTrack(
  gameId: string,
  gameTitle: string,
  overrides: Partial<PendingTrack> = {},
): PendingTrack {
  return {
    id: newId(),
    game_id: gameId,
    game_title: gameTitle,
    track_name: null,
    video_id: null,
    video_title: null,
    channel_title: null,
    thumbnail: null,
    search_queries: null,
    duration_seconds: null,
    status: TrackStatus.Pending,
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

// ─── Compilation search queries ──────────────────────────────────────────────

export function compilationQueries(gameTitle: string): string[] {
  return [
    `${gameTitle} full OST official soundtrack`,
    `${gameTitle} complete official soundtrack`,
    `${gameTitle} original game soundtrack`,
  ];
}

// ─── Tagged → Pending conversion ─────────────────────────────────────────────

export function taggedTrackToPending(
  track: TaggedTrack,
  durationSeconds: number | null,
): PendingTrack {
  return makePendingTrack(track.gameId, track.gameTitle, {
    track_name: track.cleanName,
    video_id: track.videoId,
    video_title: track.title,
    channel_title: track.channelTitle,
    thumbnail: track.thumbnail,
    duration_seconds: durationSeconds,
    status: TrackStatus.Found,
  });
}

// ─── Pending slot resolution ──────────────────────────────────────────────────

/**
 * For every track that is still in "pending" state and has search_queries
 * (full-OST compilations and fallback tracks), attempt to find a YouTube video.
 * Updates the DB in-place and mutates the passed array so the caller's
 * in-memory state stays consistent.
 */
export async function resolvePendingSlots(
  inserted: PlaylistTrack[],
  allowLongTracks = false,
  allowShortTracks = false,
): Promise<void> {
  const pendingTracks = inserted.filter(
    (t) => t.status === TrackStatus.Pending && t.search_queries,
  );
  const insertedIndexById = new Map(inserted.map((t, i) => [t.id, i]));

  for (const track of pendingTracks) {
    try {
      const video = await findBestVideo(track.search_queries ?? [], false);
      if (video) {
        if (!allowShortTracks && video.durationSeconds < MIN_TRACK_DURATION_SECONDS) {
          Playlist.setError(track.id, "Track is too short (intro or stinger).");
          continue;
        }
        if (!allowLongTracks && video.durationSeconds > MAX_TRACK_DURATION_SECONDS) {
          Playlist.setError(track.id, "Track exceeds maximum duration.");
          continue;
        }
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
            status: TrackStatus.Found,
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
    } catch (err) {
      if (err instanceof YouTubeQuotaError) throw err; // propagate quota errors immediately
      console.error(`[resolvePendingSlots] search failed for track ${track.id}:`, err);
      // Other errors: leave as pending — user can retry
    }
  }
}
