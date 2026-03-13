import { getDB } from "@/lib/db";
import { stmt } from "./_shared";

export const VideoTracks = {
  /** Returns a map of video_id → track_name (null if unaligned) for all rows belonging to a game. */
  getByGame(gameId: string): Map<string, string | null> {
    const rows = stmt("SELECT video_id, track_name FROM video_tracks WHERE game_id = ?").all(
      gameId,
    ) as { video_id: string; track_name: string | null }[];
    const map = new Map<string, string | null>();
    for (const row of rows) {
      map.set(row.video_id, row.track_name);
    }
    return map;
  },

  /** Returns a map of track_name → video_id for tracks that have been resolved (track_name IS NOT NULL). */
  getTrackToVideo(gameId: string): Map<string, string> {
    const rows = stmt(
      "SELECT video_id, track_name FROM video_tracks WHERE game_id = ? AND track_name IS NOT NULL",
    ).all(gameId) as { video_id: string; track_name: string }[];
    const map = new Map<string, string>();
    for (const row of rows) {
      map.set(row.track_name, row.video_id);
    }
    return map;
  },

  upsertBatch(rows: { videoId: string; gameId: string; trackName: string | null }[]): void {
    if (rows.length === 0) return;
    const db = getDB();
    const insert = stmt(
      `INSERT INTO video_tracks (video_id, game_id, track_name)
       VALUES (?, ?, ?)
       ON CONFLICT(video_id, game_id) DO UPDATE SET
         track_name = excluded.track_name,
         aligned_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')`,
    );
    db.transaction(() => {
      for (const row of rows) {
        insert.run(row.videoId, row.gameId, row.trackName ?? null);
      }
    })();
  },
};
