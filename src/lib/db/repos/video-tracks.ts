import { getDB } from "@/lib/db";
import { eq, and, isNotNull, sql } from "drizzle-orm";
import { videoTracks } from "@/lib/db/drizzle-schema";

export const VideoTracks = {
  async getByGame(
    gameId: string,
  ): Promise<
    Map<
      string,
      { trackName: string | null; durationSeconds: number | null; viewCount: number | null }
    >
  > {
    const rows = await getDB()
      .select({
        video_id: videoTracks.video_id,
        track_name: videoTracks.track_name,
        duration_seconds: videoTracks.duration_seconds,
        view_count: videoTracks.view_count,
      })
      .from(videoTracks)
      .where(eq(videoTracks.game_id, gameId))
      .all();

    const map = new Map<
      string,
      { trackName: string | null; durationSeconds: number | null; viewCount: number | null }
    >();
    for (const row of rows) {
      map.set(row.video_id, {
        trackName: row.track_name,
        durationSeconds: row.duration_seconds,
        viewCount: row.view_count,
      });
    }
    return map;
  },

  async getTrackToVideo(gameId: string): Promise<Map<string, string>> {
    const rows = await getDB()
      .select({ video_id: videoTracks.video_id, track_name: videoTracks.track_name })
      .from(videoTracks)
      .where(and(eq(videoTracks.game_id, gameId), isNotNull(videoTracks.track_name)))
      .all();

    const map = new Map<string, string>();
    for (const row of rows) {
      map.set(row.track_name!, row.video_id);
    }
    return map;
  },

  async upsertBatch(
    rows: { videoId: string; gameId: string; trackName: string | null }[],
  ): Promise<void> {
    if (rows.length === 0) return;
    getDB().transaction((tx) => {
      for (const row of rows) {
        tx.insert(videoTracks)
          .values({
            video_id: row.videoId,
            game_id: row.gameId,
            track_name: row.trackName ?? null,
          })
          .onConflictDoUpdate({
            target: [videoTracks.video_id, videoTracks.game_id],
            set: {
              track_name: sql`excluded.track_name`,
              aligned_at: sql`strftime('%Y-%m-%dT%H:%M:%SZ', 'now')`,
            },
          })
          .run();
      }
    });
  },

  async upsertSingle(
    gameId: string,
    trackName: string,
    fields: { videoId: string; durationSeconds?: number | null; viewCount?: number | null },
  ): Promise<void> {
    await getDB()
      .insert(videoTracks)
      .values({
        video_id: fields.videoId,
        game_id: gameId,
        track_name: trackName,
        duration_seconds: fields.durationSeconds ?? null,
        view_count: fields.viewCount ?? null,
      })
      .onConflictDoUpdate({
        target: [videoTracks.video_id, videoTracks.game_id],
        set: {
          track_name: sql`excluded.track_name`,
          duration_seconds: sql`COALESCE(excluded.duration_seconds, video_tracks.duration_seconds)`,
          view_count: sql`COALESCE(excluded.view_count, video_tracks.view_count)`,
          aligned_at: sql`strftime('%Y-%m-%dT%H:%M:%SZ', 'now')`,
        },
      })
      .run();
  },

  async storeDurations(
    entries: {
      videoId: string;
      gameId: string;
      durationSeconds: number;
      viewCount: number | null;
    }[],
  ): Promise<void> {
    if (entries.length === 0) return;
    getDB().transaction((tx) => {
      for (const e of entries) {
        tx.insert(videoTracks)
          .values({
            video_id: e.videoId,
            game_id: e.gameId,
            track_name: null,
            duration_seconds: e.durationSeconds,
            view_count: e.viewCount,
          })
          .onConflictDoUpdate({
            target: [videoTracks.video_id, videoTracks.game_id],
            set: {
              duration_seconds: sql`COALESCE(video_tracks.duration_seconds, excluded.duration_seconds)`,
              view_count: sql`excluded.view_count`,
            },
          })
          .run();
      }
    });
  },
};
