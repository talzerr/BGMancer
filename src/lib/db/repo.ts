import { getDB } from "@/lib/db";
import { toGame, toGames, toPlaylistTrack, toPlaylistTracks } from "@/lib/db/mappers";
import type { Game, PlaylistTrack, AppConfig, VibePreference, TrackStatus } from "@/types";

// ─── Games ────────────────────────────────────────────────────────────────────

export interface GameUpdateFields {
  allow_full_ost?: boolean;
  vibe_preference?: string;
}

export const Games = {
  listAll(excludeId?: string): Game[] {
    const db = getDB();
    if (excludeId) {
      return toGames(
        db.prepare("SELECT * FROM games WHERE id != ? ORDER BY created_at ASC").all(excludeId),
      );
    }
    return toGames(
      db.prepare("SELECT * FROM games ORDER BY created_at ASC").all(),
    );
  },

  getById(id: string): Game | null {
    const row = getDB()
      .prepare("SELECT * FROM games WHERE id = ?")
      .get(id) as Record<string, unknown> | undefined;
    return row ? toGame(row) : null;
  },

  create(id: string, title: string, vibe: VibePreference, allowFullOst: boolean): Game {
    getDB()
      .prepare("INSERT INTO games (id, title, vibe_preference, allow_full_ost) VALUES (?, ?, ?, ?)")
      .run(id, title, vibe, allowFullOst ? 1 : 0);
    return this.getById(id)!;
  },

  update(id: string, fields: GameUpdateFields): Game | null {
    const db = getDB();
    const now = "strftime('%Y-%m-%dT%H:%M:%SZ', 'now')";

    if (fields.allow_full_ost !== undefined) {
      db.prepare(`UPDATE games SET allow_full_ost = ?, updated_at = ${now} WHERE id = ?`)
        .run(fields.allow_full_ost ? 1 : 0, id);
    }
    if (fields.vibe_preference !== undefined) {
      db.prepare(`UPDATE games SET vibe_preference = ?, updated_at = ${now} WHERE id = ?`)
        .run(fields.vibe_preference, id);
    }

    return this.getById(id);
  },

  remove(id: string): void {
    getDB().prepare("DELETE FROM games WHERE id = ?").run(id);
  },

  ensureExists(id: string, title: string, vibe: VibePreference): void {
    const exists = getDB().prepare("SELECT id FROM games WHERE id = ?").get(id);
    if (!exists) {
      this.create(id, title, vibe, false);
    }
  },
};

// ─── Playlist Tracks ──────────────────────────────────────────────────────────

export interface InsertableTrack {
  id: string;
  game_id: string;
  track_name: string | null;
  video_id: string | null;
  video_title: string | null;
  channel_title: string | null;
  thumbnail: string | null;
  search_queries: string[] | null;
  status: TrackStatus;
  error_message: string | null;
}

export interface PendingTrackRow {
  id: string;
  search_queries: string[] | null;
  allow_full_ost: boolean;
}

export interface SyncableTrackRow {
  id: string;
  video_id: string;
  position: number;
}

export const Playlist = {
  listAllWithGameTitle(): PlaylistTrack[] {
    return toPlaylistTracks(
      getDB().prepare(`
        SELECT pt.*, g.title AS game_title
        FROM playlist_tracks pt
        JOIN games g ON g.id = pt.game_id
        ORDER BY pt.position ASC
      `).all(),
    );
  },

  listPending(): PendingTrackRow[] {
    const rows = getDB().prepare(`
      SELECT pt.id, pt.search_queries, g.allow_full_ost
      FROM playlist_tracks pt
      JOIN games g ON g.id = pt.game_id
      WHERE pt.status = 'pending'
      ORDER BY pt.position ASC
    `).all() as Array<Record<string, unknown>>;

    return rows.map((r) => ({
      id: String(r.id),
      search_queries: parseSearchQueries(r.search_queries),
      allow_full_ost: !!(r.allow_full_ost),
    }));
  },

  listUnsyncedFound(): SyncableTrackRow[] {
    return getDB().prepare(`
      SELECT id, video_id, position
      FROM playlist_tracks
      WHERE status = 'found' AND video_id IS NOT NULL AND synced_at IS NULL
      ORDER BY position ASC
    `).all() as SyncableTrackRow[];
  },

  countSynced(): number {
    const row = getDB()
      .prepare("SELECT COUNT(*) AS cnt FROM playlist_tracks WHERE synced_at IS NOT NULL")
      .get() as { cnt: number };
    return row.cnt;
  },

  replaceAll(tracks: InsertableTrack[]): void {
    const db = getDB();
    const insert = db.prepare(`
      INSERT INTO playlist_tracks
        (id, game_id, track_name, video_id, video_title, channel_title, thumbnail,
         search_queries, position, status, error_message)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    db.transaction(() => {
      db.prepare("DELETE FROM playlist_tracks").run();
      for (let position = 0; position < tracks.length; position++) {
        const t = tracks[position];
        insert.run(
          t.id, t.game_id, t.track_name, t.video_id, t.video_title,
          t.channel_title, t.thumbnail,
          t.search_queries ? JSON.stringify(t.search_queries) : null,
          position, t.status, t.error_message,
        );
      }
    })();
  },

  clearAll(): void {
    getDB().prepare("DELETE FROM playlist_tracks").run();
  },

  setSearching(id: string): void {
    getDB().prepare("UPDATE playlist_tracks SET status = 'searching' WHERE id = ?").run(id);
  },

  setFound(id: string, videoId: string, title: string, channel: string, thumbnail: string): void {
    getDB().prepare(`
      UPDATE playlist_tracks SET
        status = 'found', video_id = ?, video_title = ?,
        channel_title = ?, thumbnail = ?, error_message = NULL
      WHERE id = ?
    `).run(videoId, title, channel, thumbnail, id);
  },

  setError(id: string, message: string): void {
    getDB()
      .prepare("UPDATE playlist_tracks SET status = 'error', error_message = ? WHERE id = ?")
      .run(message, id);
  },

  markSynced(id: string): void {
    getDB()
      .prepare("UPDATE playlist_tracks SET synced_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = ?")
      .run(id);
  },
};

// ─── Config ───────────────────────────────────────────────────────────────────

export const Config = {
  load(): AppConfig {
    const rows = getDB().prepare("SELECT key, value FROM config").all() as Array<{
      key: string;
      value: string;
    }>;
    const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
    return {
      target_track_count: parseInt(map.target_track_count ?? "50", 10),
      youtube_playlist_id: map.youtube_playlist_id ?? "",
    };
  },

  upsert(key: string, value: string): void {
    getDB().prepare(`
      INSERT INTO config (key, value) VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET
        value = excluded.value,
        updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
    `).run(key, value);
  },

  getTargetTrackCount(): number {
    return this.load().target_track_count;
  },
};

// ─── Internal ─────────────────────────────────────────────────────────────────

function parseSearchQueries(raw: unknown): string[] | null {
  if (raw == null) return null;
  if (Array.isArray(raw)) return raw as string[];
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }
  return null;
}
