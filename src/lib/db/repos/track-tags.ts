import { stmt } from "./_shared";
import type { TrackRole } from "@/types";

interface TrackTagRow {
  video_id: string;
  game_id: string;
  clean_name: string;
  energy: number;
  role: string;
  is_junk: number;
  tagged_at: string;
}

function rowToTag(row: TrackTagRow): {
  videoId: string;
  gameId: string;
  cleanName: string;
  energy: 1 | 2 | 3;
  role: TrackRole;
  isJunk: boolean;
} {
  return {
    videoId: row.video_id,
    gameId: row.game_id,
    cleanName: row.clean_name,
    energy: row.energy as 1 | 2 | 3,
    role: row.role as TrackRole,
    isJunk: row.is_junk === 1,
  };
}

export const TrackTags = {
  getByGame(gameId: string) {
    const rows = stmt(
      "SELECT video_id, game_id, clean_name, energy, role, is_junk, tagged_at FROM track_tags WHERE game_id = ?",
    ).all(gameId) as TrackTagRow[];
    return rows.map(rowToTag);
  },

  getByVideoIds(videoIds: string[], gameId: string) {
    if (videoIds.length === 0) return [];
    const placeholders = videoIds.map(() => "?").join(",");
    const rows = stmt(
      `SELECT video_id, game_id, clean_name, energy, role, is_junk, tagged_at FROM track_tags WHERE game_id = ? AND video_id IN (${placeholders})`,
    ).all(gameId, ...videoIds) as TrackTagRow[];
    return rows.map(rowToTag);
  },

  upsertBatch(
    rows: Array<{
      videoId: string;
      gameId: string;
      cleanName: string;
      energy: number;
      role: string;
      isJunk: boolean;
    }>,
  ) {
    const s = stmt(
      `INSERT INTO track_tags (video_id, game_id, clean_name, energy, role, is_junk)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT (video_id, game_id) DO UPDATE SET
         clean_name = excluded.clean_name,
         energy     = excluded.energy,
         role       = excluded.role,
         is_junk    = excluded.is_junk,
         tagged_at  = strftime('%Y-%m-%dT%H:%M:%SZ','now')`,
    );
    for (const r of rows) {
      s.run(r.videoId, r.gameId, r.cleanName, r.energy, r.role, r.isJunk ? 1 : 0);
    }
  },

  deleteByGame(gameId: string) {
    stmt("DELETE FROM track_tags WHERE game_id = ?").run(gameId);
  },
} as const;
