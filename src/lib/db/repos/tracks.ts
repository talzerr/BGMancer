import { getDB } from "@/lib/db";
import { stmt } from "./_shared";
import { toTrack, toTracks } from "@/lib/db/mappers";
import type { Track } from "@/types";

export interface BackstageTrackRow extends Track {
  gameTitle: string;
  videoId: string | null;
  durationSeconds: number | null;
  viewCount: number | null;
}

function toBackstageTrackRow(r: Record<string, unknown>): BackstageTrackRow {
  return {
    ...toTrack(r),
    gameTitle: String(r.game_title),
    videoId: r.video_id != null ? String(r.video_id) : null,
    durationSeconds: r.duration_seconds != null ? Number(r.duration_seconds) : null,
    viewCount: r.view_count != null ? Number(r.view_count) : null,
  };
}

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
    // Auto-activate approved discovered tracks when they get tagged
    stmt(
      `UPDATE tracks
       SET energy = ?, role = ?, moods = ?, instrumentation = ?,
           has_vocals = ?, tagged_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now'),
           active = CASE WHEN discovered = 'approved' THEN 1 ELSE active END
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
   * Inserts a discovered track (active = 0, discovered = 'pending', position = max+1).
   * Uses INSERT OR IGNORE — safe to call multiple times for the same track.
   */
  insertDiscovered(gameId: string, name: string): void {
    stmt(
      `INSERT OR IGNORE INTO tracks (game_id, name, position, active, discovered)
       VALUES (?, ?, (SELECT COALESCE(MAX(position), 0) + 1 FROM tracks WHERE game_id = ?), 0, 'pending')`,
    ).run(gameId, name, gameId);
  },

  /** Approve discovered tracks — marks them as accepted for future tagging. */
  approveDiscovered(gameId: string, names: string[]): void {
    if (names.length === 0) return;
    const update = stmt(
      "UPDATE tracks SET discovered = 'approved' WHERE game_id = ? AND name = ? AND discovered = 'pending'",
    );
    getDB().transaction(() => {
      for (const name of names) update.run(gameId, name);
    })();
  },

  /** Reject discovered tracks — blocks re-discovery, keeps inactive. */
  rejectDiscovered(gameId: string, names: string[]): void {
    if (names.length === 0) return;
    const update = stmt(
      "UPDATE tracks SET discovered = 'rejected', active = 0 WHERE game_id = ? AND name = ?",
    );
    getDB().transaction(() => {
      for (const name of names) update.run(gameId, name);
    })();
  },

  clearTags(gameId: string): void {
    stmt(
      `UPDATE tracks
       SET energy = NULL, role = NULL, moods = NULL, instrumentation = NULL,
           has_vocals = NULL, tagged_at = NULL
       WHERE game_id = ?`,
    ).run(gameId);
  },

  /**
   * Partial update for any subset of track fields.
   * Updates `tagged_at` automatically when tag fields (energy/role/moods/instrumentation/has_vocals) change.
   */
  updateFields(
    gameId: string,
    name: string,
    fields: {
      newName?: string;
      active?: boolean;
      energy?: number | null;
      role?: string | null;
      moods?: string | null;
      instrumentation?: string | null;
      hasVocals?: boolean | null;
    },
  ): void {
    const tagFields = ["energy", "role", "moods", "instrumentation", "hasVocals"];
    const isTagChange = tagFields.some((k) => fields[k as keyof typeof fields] !== undefined);

    const setClauses: string[] = [];
    const params: unknown[] = [];

    if (fields.newName !== undefined) {
      setClauses.push("name = ?");
      params.push(fields.newName);
    }
    if (fields.active !== undefined) {
      setClauses.push("active = ?");
      params.push(fields.active ? 1 : 0);
    }
    if (fields.energy !== undefined) {
      setClauses.push("energy = ?");
      params.push(fields.energy);
    }
    if (fields.role !== undefined) {
      setClauses.push("role = ?");
      params.push(fields.role);
    }
    if (fields.moods !== undefined) {
      setClauses.push("moods = ?");
      params.push(fields.moods);
    }
    if (fields.instrumentation !== undefined) {
      setClauses.push("instrumentation = ?");
      params.push(fields.instrumentation);
    }
    if (fields.hasVocals !== undefined) {
      setClauses.push("has_vocals = ?");
      params.push(fields.hasVocals === null ? null : fields.hasVocals ? 1 : 0);
    }
    if (isTagChange) {
      setClauses.push("tagged_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')");
    }

    if (setClauses.length === 0) return;

    params.push(gameId, name);
    const db = getDB();
    db.prepare(`UPDATE tracks SET ${setClauses.join(", ")} WHERE game_id = ? AND name = ?`).run(
      ...params,
    );
  },

  /** Delete tracks by composite PK in a single transaction. Cascades to video_tracks. */
  deleteByKeys(keys: { gameId: string; name: string }[]): void {
    if (keys.length === 0) return;
    const db = getDB();
    const delVideo = db.prepare("DELETE FROM video_tracks WHERE game_id = ? AND track_name = ?");
    const delTrack = db.prepare("DELETE FROM tracks WHERE game_id = ? AND name = ?");
    db.transaction(() => {
      for (const k of keys) {
        delVideo.run(k.gameId, k.name);
        delTrack.run(k.gameId, k.name);
      }
    })();
  },

  /** Delete all tracks for a game (used by re-ingest). */
  deleteByGame(gameId: string): void {
    stmt("DELETE FROM tracks WHERE game_id = ?").run(gameId);
  },

  /**
   * Returns all tracks across all games with game title and video ID joined.
   * Used by the Backstage Track Lab for cross-game browsing.
   */
  listAllWithVideoIds(): BackstageTrackRow[] {
    const rows = stmt(`
      SELECT t.*, g.title AS game_title,
        (SELECT vt.video_id FROM video_tracks vt WHERE vt.game_id = t.game_id AND vt.track_name = t.name LIMIT 1) AS video_id,
        (SELECT vt.duration_seconds FROM video_tracks vt WHERE vt.game_id = t.game_id AND vt.track_name = t.name LIMIT 1) AS duration_seconds,
        (SELECT vt.view_count FROM video_tracks vt WHERE vt.game_id = t.game_id AND vt.track_name = t.name LIMIT 1) AS view_count
      FROM tracks t
      JOIN games g ON g.id = t.game_id
      ORDER BY g.title ASC, t.position ASC
    `).all() as Record<string, unknown>[];

    return rows.map(toBackstageTrackRow);
  },

  searchWithVideoIds(filters: {
    gameId?: string;
    gameTitle?: string;
    name?: string;
    energy?: number;
    active?: boolean;
    untaggedOnly?: boolean;
  }): BackstageTrackRow[] {
    const clauses: string[] = [];
    const params: unknown[] = [];

    if (filters.gameId) {
      clauses.push("t.game_id = ?");
      params.push(filters.gameId);
    }
    if (filters.gameTitle) {
      clauses.push("g.title LIKE ?");
      params.push(`%${filters.gameTitle}%`);
    }
    if (filters.name) {
      clauses.push("t.name LIKE ?");
      params.push(`%${filters.name}%`);
    }
    if (filters.energy != null) {
      clauses.push("t.energy = ?");
      params.push(filters.energy);
    }
    if (filters.active != null) {
      clauses.push("t.active = ?");
      params.push(filters.active ? 1 : 0);
    }
    if (filters.untaggedOnly) {
      clauses.push("t.tagged_at IS NULL");
    }

    const where = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
    const sql = `
      SELECT t.*, g.title AS game_title,
        (SELECT vt.video_id FROM video_tracks vt WHERE vt.game_id = t.game_id AND vt.track_name = t.name LIMIT 1) AS video_id,
        (SELECT vt.duration_seconds FROM video_tracks vt WHERE vt.game_id = t.game_id AND vt.track_name = t.name LIMIT 1) AS duration_seconds,
        (SELECT vt.view_count FROM video_tracks vt WHERE vt.game_id = t.game_id AND vt.track_name = t.name LIMIT 1) AS view_count
      FROM tracks t
      JOIN games g ON g.id = t.game_id
      ${where}
      ORDER BY g.title ASC, t.position ASC
      LIMIT 200
    `;
    const rows = getDB()
      .prepare(sql)
      .all(...params) as Record<string, unknown>[];
    return rows.map(toBackstageTrackRow);
  },
};
