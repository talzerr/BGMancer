import type Database from "better-sqlite3";
import { getDB, getSeedPlaylistId, LOCAL_USER_ID } from "@/lib/db";
import {
  toGame,
  toGames,
  toPlaylistTracks,
  toPlaylistSession,
  toPlaylistSessions,
  toUser,
  parseSearchQueries,
} from "@/lib/db/mappers";
import type { Game, PlaylistTrack, PlaylistSession, User, AppConfig, TrackStatus } from "@/types";
import { newId } from "@/lib/uuid";

// Prepared statements cached by SQL string — avoids recompiling on every call.
const _stmts = new Map<string, Database.Statement<unknown[]>>();
function stmt(sql: string): Database.Statement<unknown[]> {
  let s = _stmts.get(sql);
  if (!s) {
    s = getDB().prepare(sql);
    _stmts.set(sql, s);
  }
  return s;
}

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
    if (excludeId) {
      return toGames(
        stmt("SELECT * FROM games WHERE enabled = 1 AND id != ? ORDER BY created_at ASC").all(
          excludeId,
        ),
      );
    }
    return toGames(stmt("SELECT * FROM games WHERE enabled = 1 ORDER BY created_at ASC").all());
  },

  /** Returns all games regardless of enabled state — used by the library page. */
  listAllIncludingDisabled(): Game[] {
    return toGames(stmt("SELECT * FROM games ORDER BY created_at ASC").all());
  },

  getById(id: string): Game | null {
    const row = stmt("SELECT * FROM games WHERE id = ?").get(id) as
      | Record<string, unknown>
      | undefined;
    return row ? toGame(row) : null;
  },

  create(
    id: string,
    title: string,
    enabled = true,
    steamAppid: number | null = null,
    playtimeMinutes: number | null = null,
  ): Game {
    stmt(
      "INSERT INTO games (id, title, vibe_preference, allow_full_ost, enabled, steam_appid, playtime_minutes) VALUES (?, ?, 'official_soundtrack', 0, ?, ?, ?)",
    ).run(id, title, enabled ? 1 : 0, steamAppid, playtimeMinutes);

    const seededPlaylistId = getSeedPlaylistId(title);
    if (seededPlaylistId) {
      stmt("INSERT OR IGNORE INTO game_yt_playlists (game_id, playlist_id) VALUES (?, ?)").run(
        id,
        seededPlaylistId,
      );
    }

    const created = this.getById(id);
    if (!created) throw new Error(`[Games.create] game ${id} not found after INSERT`);
    return created;
  },

  update(id: string, fields: GameUpdateFields): Game | null {
    if (fields.enabled !== undefined) {
      stmt(
        `UPDATE games SET enabled = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = ?`,
      ).run(fields.enabled ? 1 : 0, id);
    }
    return this.getById(id);
  },

  remove(id: string): void {
    stmt("DELETE FROM games WHERE id = ?").run(id);
  },

  ensureExists(id: string, title: string): void {
    const exists = stmt("SELECT id FROM games WHERE id = ?").get(id);
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
    const insertSQL = `
      INSERT OR IGNORE INTO games
        (id, title, vibe_preference, allow_full_ost, enabled, steam_appid, playtime_minutes)
      VALUES (?, ?, 'official_soundtrack', 0, 0, ?, ?)
    `;
    const seedSQL = "INSERT OR IGNORE INTO game_yt_playlists (game_id, playlist_id) VALUES (?, ?)";

    let imported = 0;
    let skipped = 0;

    db.transaction(() => {
      for (const g of games) {
        const id = newId();
        const result = stmt(insertSQL).run(id, g.name, g.appid, Math.round(g.playtime_forever));
        if (result.changes > 0) {
          imported++;
          const seededPlaylistId = getSeedPlaylistId(g.name);
          if (seededPlaylistId) stmt(seedSQL).run(id, seededPlaylistId);
        } else {
          skipped++;
        }
      }
    })();

    return { imported, skipped };
  },
};

// ─── Users ────────────────────────────────────────────────────────────────────

export const Users = {
  getOrCreateDefault(): User {
    const existing = stmt("SELECT * FROM users WHERE id = ?").get(LOCAL_USER_ID) as
      | Record<string, unknown>
      | undefined;
    if (existing) return toUser(existing);

    stmt(
      "INSERT OR IGNORE INTO users (id, email, username) VALUES (?, 'local@bgmancer.app', 'Local')",
    ).run(LOCAL_USER_ID);

    const created = stmt("SELECT * FROM users WHERE id = ?").get(LOCAL_USER_ID) as Record<
      string,
      unknown
    >;
    return toUser(created);
  },

  getById(id: string): User | null {
    const row = stmt("SELECT * FROM users WHERE id = ?").get(id) as
      | Record<string, unknown>
      | undefined;
    return row ? toUser(row) : null;
  },
};

// ─── Playlist Sessions ────────────────────────────────────────────────────────

export const Sessions = {
  create(userId: string, name: string, description?: string): PlaylistSession {
    const id = newId();
    stmt("INSERT INTO playlists (id, user_id, name, description) VALUES (?, ?, ?, ?)").run(
      id,
      userId,
      name,
      description ?? null,
    );

    const created = stmt("SELECT * FROM playlists WHERE id = ?").get(id) as Record<string, unknown>;
    return toPlaylistSession(created);
  },

  /** Returns the most recently created non-archived session, or null if none exist. */
  getActive(): PlaylistSession | null {
    const row = stmt(
      "SELECT * FROM playlists WHERE is_archived = 0 ORDER BY created_at DESC LIMIT 1",
    ).get() as Record<string, unknown> | undefined;
    return row ? toPlaylistSession(row) : null;
  },

  getById(id: string): PlaylistSession | null {
    const row = stmt("SELECT * FROM playlists WHERE id = ?").get(id) as
      | Record<string, unknown>
      | undefined;
    return row ? toPlaylistSession(row) : null;
  },

  listAll(): PlaylistSession[] {
    return toPlaylistSessions(stmt("SELECT * FROM playlists ORDER BY created_at DESC").all());
  },

  archive(id: string): void {
    stmt("UPDATE playlists SET is_archived = 1 WHERE id = ?").run(id);
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

// Subquery that resolves the active (most recent non-archived) session ID.
const ACTIVE_SESSION_SQ =
  "(SELECT id FROM playlists WHERE is_archived = 0 ORDER BY created_at DESC LIMIT 1)";

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
      stmt(`
        SELECT pt.*, g.title AS game_title
        FROM playlist_tracks pt
        JOIN games g ON g.id = pt.game_id
        WHERE pt.playlist_id = ${ACTIVE_SESSION_SQ}
        ORDER BY pt.position ASC
      `).all(),
    );
  },

  listPending(): PendingTrackRow[] {
    const rows = stmt(`
      SELECT pt.id, pt.search_queries, g.allow_full_ost
      FROM playlist_tracks pt
      JOIN games g ON g.id = pt.game_id
      WHERE pt.status = 'pending'
        AND pt.playlist_id = ${ACTIVE_SESSION_SQ}
      ORDER BY pt.position ASC
    `).all() as Array<Record<string, unknown>>;

    return rows.map((r) => ({
      id: String(r.id),
      search_queries: parseSearchQueries(r.search_queries),
      allow_full_ost: !!r.allow_full_ost,
    }));
  },

  listUnsyncedFound(): SyncableTrackRow[] {
    return stmt(`
      SELECT id, video_id, position
      FROM playlist_tracks
      WHERE status = 'found'
        AND video_id IS NOT NULL
        AND synced_at IS NULL
        AND playlist_id = ${ACTIVE_SESSION_SQ}
      ORDER BY position ASC
    `).all() as SyncableTrackRow[];
  },

  countSynced(): number {
    const row = stmt(
      `SELECT COUNT(*) AS cnt FROM playlist_tracks WHERE synced_at IS NOT NULL AND playlist_id = ${ACTIVE_SESSION_SQ}`,
    ).get() as { cnt: number };
    return row.cnt;
  },

  /**
   * Atomically replaces all tracks for a given session.
   * Deletes existing tracks for that playlist_id, then bulk-inserts the new set.
   */
  replaceAll(playlistId: string, tracks: InsertableTrack[]): void {
    const db = getDB();
    const insertSQL = `
      INSERT INTO playlist_tracks
        (id, playlist_id, game_id, track_name, video_id, video_title, channel_title, thumbnail,
         search_queries, duration_seconds, position, status, error_message)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    db.transaction(() => {
      stmt("DELETE FROM playlist_tracks WHERE playlist_id = ?").run(playlistId);
      const insertStmt = stmt(insertSQL);
      for (let position = 0; position < tracks.length; position++) {
        const t = tracks[position];
        insertStmt.run(
          t.id,
          playlistId,
          t.game_id,
          t.track_name,
          t.video_id,
          t.video_title,
          t.channel_title,
          t.thumbnail,
          t.search_queries ? JSON.stringify(t.search_queries) : null,
          t.duration_seconds ?? null,
          position,
          t.status,
          t.error_message,
        );
      }
    })();
  },

  /** Deletes all tracks belonging to the active session. */
  clearAll(): void {
    stmt(`DELETE FROM playlist_tracks WHERE playlist_id = ${ACTIVE_SESSION_SQ}`).run();
  },

  setSearching(id: string): void {
    stmt("UPDATE playlist_tracks SET status = 'searching' WHERE id = ?").run(id);
  },

  setFound(
    id: string,
    videoId: string,
    title: string,
    channel: string,
    thumbnail: string,
    durationSeconds: number | null = null,
  ): void {
    stmt(`
      UPDATE playlist_tracks SET
        status = 'found', video_id = ?, video_title = ?,
        channel_title = ?, thumbnail = ?, duration_seconds = ?, error_message = NULL
      WHERE id = ?
    `).run(videoId, title, channel, thumbnail, durationSeconds, id);
  },

  setError(id: string, message: string): void {
    stmt("UPDATE playlist_tracks SET status = 'error', error_message = ? WHERE id = ?").run(
      message,
      id,
    );
  },

  markSynced(id: string): void {
    stmt(
      "UPDATE playlist_tracks SET synced_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = ?",
    ).run(id);
  },

  removeOne(id: string): void {
    stmt("DELETE FROM playlist_tracks WHERE id = ?").run(id);
  },

  getById(id: string): PlaylistTrack | undefined {
    const rows = toPlaylistTracks(
      stmt(`
        SELECT pt.*, g.title AS game_title
        FROM playlist_tracks pt
        JOIN games g ON g.id = pt.game_id
        WHERE pt.id = ?
      `).all(id),
    );
    return rows[0];
  },

  getVideoIdsForGame(gameId: string): string[] {
    const rows = stmt(
      "SELECT video_id FROM playlist_tracks WHERE game_id = ? AND video_id IS NOT NULL",
    ).all(gameId) as Array<{ video_id: string }>;
    return rows.map((r) => r.video_id);
  },

  reorder(orderedIds: string[]): void {
    const db = getDB();
    const updateStmt = stmt("UPDATE playlist_tracks SET position = ? WHERE id = ?");
    db.transaction(() => {
      for (let i = 0; i < orderedIds.length; i++) {
        updateStmt.run(i, orderedIds[i]);
      }
    })();
  },
};

// ─── YouTube Playlist Cache ───────────────────────────────────────────────────

export const YtPlaylists = {
  /** Returns a map of game_id → playlist_id for all cached entries. */
  listAllAsMap(): Record<string, string> {
    const rows = stmt("SELECT game_id, playlist_id FROM game_yt_playlists").all() as Array<{
      game_id: string;
      playlist_id: string;
    }>;
    return Object.fromEntries(rows.map((r) => [r.game_id, r.playlist_id]));
  },

  /** Returns all cached entries joined with game title — used for seed export. */
  listAll(): Array<{ game_title: string; playlist_id: string }> {
    return stmt(`
      SELECT g.title AS game_title, yp.playlist_id
      FROM game_yt_playlists yp
      JOIN games g ON g.id = yp.game_id
      ORDER BY g.title ASC
    `).all() as Array<{ game_title: string; playlist_id: string }>;
  },

  /** Returns the cached YouTube playlist ID for a game, or null if not cached. */
  get(gameId: string): string | null {
    const row = stmt("SELECT playlist_id FROM game_yt_playlists WHERE game_id = ?").get(gameId) as
      | { playlist_id: string }
      | undefined;
    return row?.playlist_id ?? null;
  },

  /** Inserts or updates the cached playlist ID for a game. */
  upsert(gameId: string, playlistId: string): void {
    stmt(`
      INSERT INTO game_yt_playlists (game_id, playlist_id)
      VALUES (?, ?)
      ON CONFLICT(game_id) DO UPDATE SET
        playlist_id   = excluded.playlist_id,
        discovered_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
    `).run(gameId, playlistId);
  },

  /** Removes the cached entry for a game, forcing re-discovery on next generation. */
  clearForGame(gameId: string): void {
    stmt("DELETE FROM game_yt_playlists WHERE game_id = ?").run(gameId);
  },

  /** Returns all cached entries joined with game title — used by dev panel. */
  loadRaw(): Array<{
    game_id: string;
    game_title: string;
    playlist_id: string;
    discovered_at: string;
  }> {
    return stmt(`
      SELECT yp.game_id, g.title AS game_title, yp.playlist_id, yp.discovered_at
      FROM game_yt_playlists yp
      JOIN games g ON g.id = yp.game_id
      ORDER BY yp.discovered_at DESC
    `).all() as Array<{
      game_id: string;
      game_title: string;
      playlist_id: string;
      discovered_at: string;
    }>;
  },
};

// ─── Config ───────────────────────────────────────────────────────────────────

export const Config = {
  load(): AppConfig {
    const rows = stmt("SELECT key, value FROM config").all() as Array<{
      key: string;
      value: string;
    }>;
    const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
    return {
      target_track_count: parseInt(map.target_track_count ?? "50", 10),
      youtube_playlist_id: map.youtube_playlist_id ?? "",
      anti_spoiler_enabled: map.anti_spoiler_enabled === "1",
    };
  },

  upsert(key: string, value: string): void {
    stmt(`
      INSERT INTO config (key, value) VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET
        value = excluded.value,
        updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
    `).run(key, value);
  },

  /** Writes multiple key/value pairs in a single transaction. */
  upsertBatch(entries: Array<[key: string, value: string]>): void {
    if (entries.length === 0) return;
    const db = getDB();
    const upsertSQL = `
      INSERT INTO config (key, value) VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET
        value = excluded.value,
        updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
    `;
    db.transaction(() => {
      for (const [key, value] of entries) {
        stmt(upsertSQL).run(key, value);
      }
    })();
  },

  loadRaw(): Array<{ key: string; value: string; updated_at: string }> {
    return stmt("SELECT key, value, updated_at FROM config ORDER BY key ASC").all() as Array<{
      key: string;
      value: string;
      updated_at: string;
    }>;
  },

  getTargetTrackCount(): number {
    return this.load().target_track_count;
  },
};
