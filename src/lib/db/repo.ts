import { getDB, getSeedPlaylistId } from "@/lib/db";
import { toGame, toGames, toPlaylistTrack, toPlaylistTracks, parseSearchQueries } from "@/lib/db/mappers";
import type { Game, PlaylistTrack, AppConfig, VibePreference, TrackStatus } from "@/types";
import { VIBE_LABELS } from "@/types";

const VALID_VIBES = new Set<string>(Object.keys(VIBE_LABELS));

// ─── Games ────────────────────────────────────────────────────────────────────

export interface GameUpdateFields {
  enabled?: boolean;
}

export interface SteamGameInput {
  appid: number;
  name: string;
  playtime_forever: number;
}

export const Games = {
  /** Returns only enabled games — used for playlist generation. */
  listAll(excludeId?: string): Game[] {
    const db = getDB();
    if (excludeId) {
      return toGames(
        db.prepare("SELECT * FROM games WHERE enabled = 1 AND id != ? ORDER BY created_at ASC").all(excludeId),
      );
    }
    return toGames(
      db.prepare("SELECT * FROM games WHERE enabled = 1 ORDER BY created_at ASC").all(),
    );
  },

  /** Returns all games regardless of enabled state — used by the library page. */
  listAllIncludingDisabled(): Game[] {
    return toGames(
      getDB().prepare("SELECT * FROM games ORDER BY created_at ASC").all(),
    );
  },

  getById(id: string): Game | null {
    const row = getDB()
      .prepare("SELECT * FROM games WHERE id = ?")
      .get(id) as Record<string, unknown> | undefined;
    return row ? toGame(row) : null;
  },

  create(
    id: string,
    title: string,
    enabled = true,
    steamAppid: number | null = null,
    playtimeMinutes: number | null = null,
  ): Game {
    const db = getDB();
    db.prepare(
      "INSERT INTO games (id, title, vibe_preference, allow_full_ost, enabled, steam_appid, playtime_minutes) VALUES (?, ?, 'official_soundtrack', 0, ?, ?, ?)",
    ).run(id, title, enabled ? 1 : 0, steamAppid, playtimeMinutes);

    const seededPlaylistId = getSeedPlaylistId(title);
    if (seededPlaylistId) {
      db.prepare("INSERT OR IGNORE INTO game_yt_playlists (game_id, playlist_id) VALUES (?, ?)")
        .run(id, seededPlaylistId);
    }

    return this.getById(id)!;
  },

  update(id: string, fields: GameUpdateFields): Game | null {
    const db = getDB();
    const now = "strftime('%Y-%m-%dT%H:%M:%SZ', 'now')";

    if (fields.enabled !== undefined) {
      db.prepare(`UPDATE games SET enabled = ?, updated_at = ${now} WHERE id = ?`)
        .run(fields.enabled ? 1 : 0, id);
    }

    return this.getById(id);
  },

  remove(id: string): void {
    getDB().prepare("DELETE FROM games WHERE id = ?").run(id);
  },

  ensureExists(id: string, title: string): void {
    const exists = getDB().prepare("SELECT id FROM games WHERE id = ?").get(id);
    if (!exists) {
      this.create(id, title, false);
    }
  },

  /**
   * Bulk-inserts Steam games as disabled (enabled=0).
   * Silently skips entries whose steam_appid already exists (via the unique index).
   * Returns the count of newly inserted and skipped rows.
   */
  bulkImportSteam(games: SteamGameInput[]): { imported: number; skipped: number } {
    const db = getDB();
    const insert = db.prepare(`
      INSERT OR IGNORE INTO games
        (id, title, vibe_preference, allow_full_ost, enabled, steam_appid, playtime_minutes)
      VALUES (?, ?, 'official_soundtrack', 0, 0, ?, ?)
    `);
    const seedInsert = db.prepare(
      "INSERT OR IGNORE INTO game_yt_playlists (game_id, playlist_id) VALUES (?, ?)",
    );

    let imported = 0;
    let skipped = 0;

    db.transaction(() => {
      for (const g of games) {
        const id = crypto.randomUUID();
        const result = insert.run(id, g.name, g.appid, Math.round(g.playtime_forever));
        if (result.changes > 0) {
          imported++;
          const seededPlaylistId = getSeedPlaylistId(g.name);
          if (seededPlaylistId) seedInsert.run(id, seededPlaylistId);
        } else {
          skipped++;
        }
      }
    })();

    return { imported, skipped };
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
  duration_seconds?: number | null;
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
         search_queries, duration_seconds, position, status, error_message)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    db.transaction(() => {
      db.prepare("DELETE FROM playlist_tracks").run();
      for (let position = 0; position < tracks.length; position++) {
        const t = tracks[position];
        insert.run(
          t.id, t.game_id, t.track_name, t.video_id, t.video_title,
          t.channel_title, t.thumbnail,
          t.search_queries ? JSON.stringify(t.search_queries) : null,
          t.duration_seconds ?? null,
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

  setFound(id: string, videoId: string, title: string, channel: string, thumbnail: string, durationSeconds: number | null = null): void {
    getDB().prepare(`
      UPDATE playlist_tracks SET
        status = 'found', video_id = ?, video_title = ?,
        channel_title = ?, thumbnail = ?, duration_seconds = ?, error_message = NULL
      WHERE id = ?
    `).run(videoId, title, channel, thumbnail, durationSeconds, id);
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

// ─── YouTube Playlist Cache ───────────────────────────────────────────────────

export const YtPlaylists = {
  /** Returns a map of game_id → playlist_id for all cached entries. */
  listAllAsMap(): Record<string, string> {
    const rows = getDB()
      .prepare("SELECT game_id, playlist_id FROM game_yt_playlists")
      .all() as Array<{ game_id: string; playlist_id: string }>;
    return Object.fromEntries(rows.map((r) => [r.game_id, r.playlist_id]));
  },

  /** Returns all cached entries joined with game title — used for seed export. */
  listAll(): Array<{ game_title: string; playlist_id: string }> {
    return getDB().prepare(`
      SELECT g.title AS game_title, yp.playlist_id
      FROM game_yt_playlists yp
      JOIN games g ON g.id = yp.game_id
      ORDER BY g.title ASC
    `).all() as Array<{ game_title: string; playlist_id: string }>;
  },

  /** Returns the cached YouTube playlist ID for a game, or null if not cached. */
  get(gameId: string): string | null {
    const row = getDB()
      .prepare("SELECT playlist_id FROM game_yt_playlists WHERE game_id = ?")
      .get(gameId) as { playlist_id: string } | undefined;
    return row?.playlist_id ?? null;
  },

  /** Inserts or updates the cached playlist ID for a game. */
  upsert(gameId: string, playlistId: string): void {
    getDB().prepare(`
      INSERT INTO game_yt_playlists (game_id, playlist_id)
      VALUES (?, ?)
      ON CONFLICT(game_id) DO UPDATE SET
        playlist_id   = excluded.playlist_id,
        discovered_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
    `).run(gameId, playlistId);
  },

  /** Removes the cached entry for a game, forcing re-discovery on next generation. */
  clearForGame(gameId: string): void {
    getDB()
      .prepare("DELETE FROM game_yt_playlists WHERE game_id = ?")
      .run(gameId);
  },

  /** Returns all cached entries joined with game title — used by dev panel. */
  loadRaw(): Array<{ game_id: string; game_title: string; playlist_id: string; discovered_at: string }> {
    return getDB().prepare(`
      SELECT yp.game_id, g.title AS game_title, yp.playlist_id, yp.discovered_at
      FROM game_yt_playlists yp
      JOIN games g ON g.id = yp.game_id
      ORDER BY yp.discovered_at DESC
    `).all() as Array<{ game_id: string; game_title: string; playlist_id: string; discovered_at: string }>;
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
    const rawVibe = map.vibe ?? "official_soundtrack";
    return {
      target_track_count: parseInt(map.target_track_count ?? "50", 10),
      youtube_playlist_id: map.youtube_playlist_id ?? "",
      vibe: (VALID_VIBES.has(rawVibe) ? rawVibe : "official_soundtrack") as VibePreference,
      anti_spoiler_enabled: map.anti_spoiler_enabled === "1",
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

  loadRaw(): Array<{ key: string; value: string; updated_at: string }> {
    return getDB()
      .prepare("SELECT key, value, updated_at FROM config ORDER BY key ASC")
      .all() as Array<{ key: string; value: string; updated_at: string }>;
  },

  getTargetTrackCount(): number {
    return this.load().target_track_count;
  },
};

