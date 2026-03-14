import { getDB } from "@/lib/db";
import { stmt } from "./_shared";
import { toTracks } from "@/lib/db/mappers";
import type { Track } from "@/types";

export const Tracks = {
  getByGame(gameId: string): Track[] {
    return toTracks(stmt("SELECT * FROM tracks WHERE game_id = ? ORDER BY position").all(gameId));
  },

  upsertBatch(
    tracks: Array<{
      gameId: string;
      name: string;
      position: number;
      durationSeconds?: number | null;
    }>,
  ): void {
    const db = getDB();
    const insert = stmt(
      `INSERT INTO tracks (game_id, name, position, duration_seconds)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(game_id, name) DO UPDATE SET
         position = excluded.position,
         duration_seconds = COALESCE(excluded.duration_seconds, duration_seconds)`,
    );
    db.transaction(() => {
      for (const t of tracks) {
        insert.run(t.gameId, t.name, t.position, t.durationSeconds ?? null);
      }
    })();
  },

  hasData(gameId: string): boolean {
    const row = stmt("SELECT COUNT(*) AS cnt FROM tracks WHERE game_id = ?").get(gameId) as {
      cnt: number;
    };
    return row.cnt > 0;
  },

  isTagged(gameId: string): boolean {
    const row = stmt(
      "SELECT COUNT(*) AS cnt FROM tracks WHERE game_id = ? AND tagged_at IS NOT NULL",
    ).get(gameId) as { cnt: number };
    return row.cnt > 0;
  },

  updateTags(
    gameId: string,
    name: string,
    tags: {
      energy: number;
      roles: string;
      moods: string;
      instrumentation: string;
      hasVocals: boolean;
    },
  ): void {
    stmt(
      `UPDATE tracks
       SET energy = ?, role = ?, moods = ?, instrumentation = ?,
           has_vocals = ?, tagged_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
       WHERE game_id = ? AND name = ?`,
    ).run(
      tags.energy,
      tags.roles,
      tags.moods,
      tags.instrumentation,
      tags.hasVocals ? 1 : 0,
      gameId,
      name,
    );
  },

  /**
   * Inserts a discovered track (active = 0, position = max+1).
   * Uses INSERT OR IGNORE — safe to call multiple times for the same track.
   */
  insertDiscovered(gameId: string, name: string): void {
    stmt(
      `INSERT OR IGNORE INTO tracks (game_id, name, position, active)
       VALUES (?, ?, (SELECT COALESCE(MAX(position), 0) + 1 FROM tracks WHERE game_id = ?), 0)`,
    ).run(gameId, name, gameId);
  },

  clearTags(gameId: string): void {
    stmt(
      `UPDATE tracks
       SET energy = NULL, role = NULL, moods = NULL, instrumentation = NULL,
           has_vocals = NULL, tagged_at = NULL
       WHERE game_id = ?`,
    ).run(gameId);
  },
};
