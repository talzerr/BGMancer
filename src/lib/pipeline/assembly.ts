import type { InsertableTrack } from "@/lib/db/repo";
import { newId } from "@/lib/uuid";
import type { TaggedTrack } from "@/types";
import type { PendingTrack } from "@/lib/pipeline/types";

// ─── Tagged → PendingTrack conversion ───────────────────────────────────────

export function taggedTrackToPending(
  track: TaggedTrack,
  durationSeconds: number | null,
): PendingTrack {
  return {
    id: newId(),
    game_id: track.gameId,
    game_title: track.gameTitle,
    track_name: track.title,
    video_id: track.videoId,
    video_title: track.title,
    channel_title: null,
    thumbnail: null,
    duration_seconds: durationSeconds,
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
    duration_seconds: t.duration_seconds,
  }));
}
