import type Database from "better-sqlite3";
import { getDB, getSeedPlaylistId } from "@/lib/db";
import { MAX_PLAYLIST_SESSIONS, DEFAULT_TRACK_COUNT, YT_IMPORT_GAME_ID } from "@/lib/constants";
import {
  toGame,
  toGames,
  toPlaylistTracks,
  toPlaylistSession,
  toUser,
  parseSearchQueries,
} from "@/lib/db/mappers";
import { CurationMode, UserTier } from "@/types";
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

// Parameterized subquery templates (userId bound as '?' at call time).
const LIBRARY_SQ = "(SELECT id FROM libraries WHERE user_id = ? LIMIT 1)";
const ACTIVE_SESSION_SQ =
  "(SELECT id FROM playlists WHERE user_id = ? AND is_archived = 0 ORDER BY created_at DESC LIMIT 1)";

// ─── Games ────────────────────────────────────────────────────────────────────

export interface GameUpdateFields {
  curation?: CurationMode;
}

export interface SteamGameInput {
  appid: number;
  name: string;
  playtime_forever: number;
}

export const Games = {
  /** Returns all non-skip games in the user's library — used for playlist generation. */
  listAll(userId: string, excludeId?: string): Game[] {
    const base = `
      SELECT g.* FROM games g
      JOIN library_games lg ON lg.game_id = g.id
      WHERE lg.library_id = ${LIBRARY_SQ}
        AND g.curation != 'skip'
    `;
    if (excludeId) {
      return toGames(stmt(`${base} AND g.id != ? ORDER BY lg.added_at ASC`).all(userId, excludeId));
    }
    return toGames(stmt(`${base} ORDER BY lg.added_at ASC`).all(userId));
  },

  /** Returns all games in the user's library regardless of curation — used by the library page. */
  listAllIncludingDisabled(userId: string): Game[] {
    return toGames(
      stmt(`
        SELECT g.* FROM games g
        JOIN library_games lg ON lg.game_id = g.id
        WHERE lg.library_id = ${LIBRARY_SQ}
        ORDER BY lg.added_at ASC
      `).all(userId),
    );
  },

  /** Returns the number of real games in the user's library, excluding the synthetic YT-import entry. */
  count(userId: string): number {
    const row = stmt(`
      SELECT COUNT(*) AS cnt FROM games g
      JOIN library_games lg ON lg.game_id = g.id
      WHERE lg.library_id = ${LIBRARY_SQ}
        AND g.id != '${YT_IMPORT_GAME_ID}'
    `).get(userId) as { cnt: number };
    return row.cnt;
  },

  getById(id: string): Game | null {
    const row = stmt("SELECT * FROM games WHERE id = ?").get(id) as
      | Record<string, unknown>
      | undefined;
    return row ? toGame(row) : null;
  },

  create(
    userId: string,
    id: string,
    title: string,
    curation: CurationMode = CurationMode.Include,
    steamAppid: number | null = null,
    playtimeMinutes: number | null = null,
  ): Game {
    const db = getDB();
    db.transaction(() => {
      stmt(
        "INSERT INTO games (id, title, allow_full_ost, curation, steam_appid, playtime_minutes) VALUES (?, ?, 0, ?, ?, ?)",
      ).run(id, title, curation, steamAppid, playtimeMinutes);

      stmt(
        `INSERT OR IGNORE INTO library_games (library_id, game_id) VALUES (${LIBRARY_SQ}, ?)`,
      ).run(userId, id);

      const seededPlaylistId = getSeedPlaylistId(title);
      if (seededPlaylistId) {
        stmt(
          "INSERT OR IGNORE INTO game_yt_playlists (game_id, user_id, playlist_id) VALUES (?, '', ?)",
        ).run(id, seededPlaylistId);
      }
    })();

    const created = this.getById(id);
    if (!created) throw new Error(`[Games.create] game ${id} not found after INSERT`);
    return created;
  },

  update(id: string, fields: GameUpdateFields): Game | null {
    if (fields.curation !== undefined) {
      stmt(
        `UPDATE games SET curation = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = ?`,
      ).run(fields.curation, id);
    }
    return this.getById(id);
  },

  /** Removes the game from the user's library (and deletes the game row if it has no other library entries). */
  remove(userId: string, id: string): void {
    const db = getDB();
    db.transaction(() => {
      stmt(`DELETE FROM library_games WHERE library_id = ${LIBRARY_SQ} AND game_id = ?`).run(
        userId,
        id,
      );
      const remaining = stmt("SELECT COUNT(*) AS cnt FROM library_games WHERE game_id = ?").get(
        id,
      ) as { cnt: number };
      if (remaining.cnt === 0) {
        stmt("DELETE FROM games WHERE id = ?").run(id);
      }
    })();
  },

  ensureExists(userId: string, id: string, title: string): void {
    const exists = stmt("SELECT id FROM games WHERE id = ?").get(id);
    if (!exists) {
      this.create(userId, id, title, CurationMode.Skip);
    } else {
      // Ensure it's in this user's library (idempotent)
      stmt(
        `INSERT OR IGNORE INTO library_games (library_id, game_id) VALUES (${LIBRARY_SQ}, ?)`,
      ).run(userId, id);
    }
  },

  /**
   * Bulk-inserts Steam games as disabled (curation='skip') into the user's library.
   * Silently skips entries whose steam_appid already exists (via the unique index).
   * Returns the count of newly inserted and skipped rows.
   */
  bulkImportSteam(userId: string, games: SteamGameInput[]): { imported: number; skipped: number } {
    const db = getDB();
    const insertGameSQL = `
      INSERT OR IGNORE INTO games
        (id, title, allow_full_ost, curation, steam_appid, playtime_minutes)
      VALUES (?, ?, 0, 'skip', ?, ?)
    `;
    const insertLibrarySQL = `INSERT OR IGNORE INTO library_games (library_id, game_id) VALUES (${LIBRARY_SQ}, ?)`;
    const seedSQL =
      "INSERT OR IGNORE INTO game_yt_playlists (game_id, user_id, playlist_id) VALUES (?, '', ?)";

    let imported = 0;
    let skipped = 0;

    db.transaction(() => {
      for (const g of games) {
        const id = newId();
        const result = stmt(insertGameSQL).run(id, g.name, g.appid, Math.round(g.playtime_forever));
        if (result.changes > 0) {
          imported++;
          stmt(insertLibrarySQL).run(userId, id);
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
  /**
   * Returns the user if they exist, otherwise creates user + library atomically.
   * Safe to call on every request — INSERT OR IGNORE makes it idempotent.
   */
  getOrCreate(id: string): User {
    const existing = stmt("SELECT * FROM users WHERE id = ?").get(id) as
      | Record<string, unknown>
      | undefined;
    if (existing) return toUser(existing);

    const db = getDB();
    db.transaction(() => {
      stmt(
        "INSERT OR IGNORE INTO users (id, email, username, tier) VALUES (?, ?, NULL, 'bard')",
      ).run(id, `anon+${id}@bgmancer.app`);
      stmt("INSERT OR IGNORE INTO libraries (id, user_id) VALUES (?, ?)").run(newId(), id);
    })();

    const created = stmt("SELECT * FROM users WHERE id = ?").get(id) as Record<string, unknown>;
    return toUser(created);
  },

  getById(id: string): User | null {
    const row = stmt("SELECT * FROM users WHERE id = ?").get(id) as
      | Record<string, unknown>
      | undefined;
    return row ? toUser(row) : null;
  },

  getTier(id: string): UserTier {
    const row = stmt("SELECT tier FROM users WHERE id = ?").get(id) as { tier: string } | undefined;
    return row?.tier === UserTier.Maestro ? UserTier.Maestro : UserTier.Bard;
  },

  /**
   * Atomically checks and acquires the per-user generation lock.
   * Returns { acquired: true } or { acquired: false, reason: string }.
   */
  tryAcquireGenerationLock(id: string, cooldownMs: number): { acquired: boolean; reason?: string } {
    const db = getDB();
    return db.transaction(() => {
      const row = stmt("SELECT is_generating, last_generated_at FROM users WHERE id = ?").get(
        id,
      ) as { is_generating: number; last_generated_at: string | null } | undefined;

      if (!row) return { acquired: false, reason: "User not found" };

      if (row.is_generating) {
        return {
          acquired: false,
          reason: "A generation is already in progress. Please wait for it to finish.",
        };
      }

      const lastGenTime = row.last_generated_at ? new Date(row.last_generated_at).getTime() : 0;
      const cooldownRemaining = cooldownMs - (Date.now() - lastGenTime);
      if (cooldownRemaining > 0) {
        return {
          acquired: false,
          reason: `Please wait ${Math.ceil(cooldownRemaining / 1000)}s before generating again.`,
        };
      }

      stmt("UPDATE users SET is_generating = 1 WHERE id = ?").run(id);
      return { acquired: true };
    })();
  },

  /** Releases the generation lock and stamps the completion time for cooldown tracking. */
  releaseGenerationLock(id: string): void {
    stmt(
      "UPDATE users SET is_generating = 0, last_generated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = ?",
    ).run(id);
  },
};

// ─── Playlist Sessions ────────────────────────────────────────────────────────

export const Sessions = {
  /** Creates a new session, enforcing a MAX_PLAYLIST_SESSIONS-per-user FIFO limit. */
  create(userId: string, name: string, description?: string): PlaylistSession {
    const { cnt } = stmt("SELECT COUNT(*) AS cnt FROM playlists WHERE user_id = ?").get(userId) as {
      cnt: number;
    };

    if (cnt >= MAX_PLAYLIST_SESSIONS) {
      stmt(
        "DELETE FROM playlists WHERE id = (SELECT id FROM playlists WHERE user_id = ? ORDER BY created_at ASC LIMIT 1)",
      ).run(userId);
    }

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

  /** Returns the most recently created non-archived session for the user, or null if none exist. */
  getActive(userId: string): PlaylistSession | null {
    const row = stmt(
      "SELECT * FROM playlists WHERE user_id = ? AND is_archived = 0 ORDER BY created_at DESC LIMIT 1",
    ).get(userId) as Record<string, unknown> | undefined;
    return row ? toPlaylistSession(row) : null;
  },

  getById(id: string): PlaylistSession | null {
    const row = stmt("SELECT * FROM playlists WHERE id = ?").get(id) as
      | Record<string, unknown>
      | undefined;
    return row ? toPlaylistSession(row) : null;
  },

  /** Returns all sessions for the user with a track_count field, newest first. */
  listAllWithCounts(userId: string): Array<PlaylistSession & { track_count: number }> {
    const rows = stmt(`
      SELECT p.*, COUNT(pt.id) AS track_count
      FROM playlists p
      LEFT JOIN playlist_tracks pt ON pt.playlist_id = p.id
      WHERE p.user_id = ?
      GROUP BY p.id
      ORDER BY p.created_at DESC
    `).all(userId) as Array<Record<string, unknown>>;

    return rows.map((r) => ({
      ...toPlaylistSession(r),
      track_count: Number(r.track_count ?? 0),
    }));
  },

  rename(id: string, name: string): void {
    stmt("UPDATE playlists SET name = ? WHERE id = ?").run(name, id);
  },

  /** Hard-deletes a session and all its tracks (via CASCADE). */
  delete(id: string): void {
    stmt("DELETE FROM playlists WHERE id = ?").run(id);
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
  listAllWithGameTitle(userId: string, sessionId?: string): PlaylistTrack[] {
    if (sessionId) {
      return toPlaylistTracks(
        stmt(`
          SELECT pt.*, g.title AS game_title
          FROM playlist_tracks pt
          JOIN games g ON g.id = pt.game_id
          WHERE pt.playlist_id = ?
          ORDER BY pt.position ASC
        `).all(sessionId),
      );
    }
    return toPlaylistTracks(
      stmt(`
        SELECT pt.*, g.title AS game_title
        FROM playlist_tracks pt
        JOIN games g ON g.id = pt.game_id
        WHERE pt.playlist_id = ${ACTIVE_SESSION_SQ}
        ORDER BY pt.position ASC
      `).all(userId),
    );
  },

  listPending(userId: string): PendingTrackRow[] {
    const rows = stmt(`
      SELECT pt.id, pt.search_queries, g.allow_full_ost
      FROM playlist_tracks pt
      JOIN games g ON g.id = pt.game_id
      WHERE pt.status = 'pending'
        AND pt.playlist_id = ${ACTIVE_SESSION_SQ}
      ORDER BY pt.position ASC
    `).all(userId) as Array<Record<string, unknown>>;

    return rows.map((r) => ({
      id: String(r.id),
      search_queries: parseSearchQueries(r.search_queries),
      allow_full_ost: !!r.allow_full_ost,
    }));
  },

  listUnsyncedFound(userId: string): SyncableTrackRow[] {
    return stmt(`
      SELECT id, video_id, position
      FROM playlist_tracks
      WHERE status = 'found'
        AND video_id IS NOT NULL
        AND synced_at IS NULL
        AND playlist_id = ${ACTIVE_SESSION_SQ}
      ORDER BY position ASC
    `).all(userId) as SyncableTrackRow[];
  },

  countSynced(userId: string): number {
    const row = stmt(
      `SELECT COUNT(*) AS cnt FROM playlist_tracks WHERE synced_at IS NOT NULL AND playlist_id = ${ACTIVE_SESSION_SQ}`,
    ).get(userId) as { cnt: number };
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

  /** Deletes all tracks belonging to the user's active session. */
  clearAll(userId: string): void {
    stmt(`DELETE FROM playlist_tracks WHERE playlist_id = ${ACTIVE_SESSION_SQ}`).run(userId);
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
//
// Two-layer cache:
//   user_id = ''  → global shared entry (auto-discovery, seed file) — visible to all users
//   user_id = uid → personal override for that user only
//
// Lookup order: user override → global by game_id → global by game title (cross-user sharing)

export const YtPlaylists = {
  /**
   * Returns the effective playlist ID for a game.
   * Checks (in order): user override, global for this game_id, global by title.
   * Pass gameTitle to enable cross-user sharing for manually-added games.
   */
  get(gameId: string, userId: string, gameTitle?: string): string | null {
    // 1. User-specific override
    const userRow = stmt(
      "SELECT playlist_id FROM game_yt_playlists WHERE game_id = ? AND user_id = ?",
    ).get(gameId, userId) as { playlist_id: string } | undefined;
    if (userRow) return userRow.playlist_id;

    // 2. Global entry for this exact game_id
    const globalRow = stmt(
      "SELECT playlist_id FROM game_yt_playlists WHERE game_id = ? AND user_id = ''",
    ).get(gameId) as { playlist_id: string } | undefined;
    if (globalRow) return globalRow.playlist_id;

    // 3. Global entry for any game with the same title (cross-user sharing for manual games)
    if (gameTitle) {
      const titleRow = stmt(`
        SELECT yp.playlist_id FROM game_yt_playlists yp
        JOIN games g ON g.id = yp.game_id
        WHERE yp.user_id = '' AND g.title = ?
        LIMIT 1
      `).get(gameTitle) as { playlist_id: string } | undefined;
      if (titleRow) return titleRow.playlist_id;
    }

    return null;
  },

  /** Upserts a globally shared cache entry (auto-discovery, seed file). */
  upsert(gameId: string, playlistId: string): void {
    stmt(`
      INSERT INTO game_yt_playlists (game_id, user_id, playlist_id)
      VALUES (?, '', ?)
      ON CONFLICT(game_id, user_id) DO UPDATE SET
        playlist_id   = excluded.playlist_id,
        discovered_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
    `).run(gameId, playlistId);
  },

  /** Upserts a per-user playlist override. Does not affect other users. */
  upsertForUser(gameId: string, userId: string, playlistId: string): void {
    stmt(`
      INSERT INTO game_yt_playlists (game_id, user_id, playlist_id)
      VALUES (?, ?, ?)
      ON CONFLICT(game_id, user_id) DO UPDATE SET
        playlist_id   = excluded.playlist_id,
        discovered_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
    `).run(gameId, userId, playlistId);
  },

  /** Clears the user's personal override, falling back to the global cache. */
  clearForUser(gameId: string, userId: string): void {
    stmt("DELETE FROM game_yt_playlists WHERE game_id = ? AND user_id = ?").run(gameId, userId);
  },

  /** Clears the global shared entry for a game (dev use). */
  clearForGame(gameId: string): void {
    stmt("DELETE FROM game_yt_playlists WHERE game_id = ? AND user_id = ''").run(gameId);
  },

  /**
   * Returns a merged {game_id: playlist_id} map for a user.
   * User overrides take precedence over global entries.
   */
  listAllAsMap(userId: string): Record<string, string> {
    const rows = stmt(`
      SELECT game_id, playlist_id FROM game_yt_playlists WHERE user_id = ?
      UNION
      SELECT game_id, playlist_id FROM game_yt_playlists
      WHERE user_id = '' AND game_id NOT IN (
        SELECT game_id FROM game_yt_playlists WHERE user_id = ?
      )
    `).all(userId, userId) as Array<{ game_id: string; playlist_id: string }>;
    return Object.fromEntries(rows.map((r) => [r.game_id, r.playlist_id]));
  },

  /** Returns all global cached entries joined with game title — used for seed export. */
  listAll(): Array<{ game_title: string; playlist_id: string }> {
    return stmt(`
      SELECT g.title AS game_title, yp.playlist_id
      FROM game_yt_playlists yp
      JOIN games g ON g.id = yp.game_id
      WHERE yp.user_id = ''
      ORDER BY g.title ASC
    `).all() as Array<{ game_title: string; playlist_id: string }>;
  },

  /** Returns all entries (global + user overrides) for the dev panel. */
  loadRaw(): Array<{
    game_id: string;
    game_title: string;
    playlist_id: string;
    discovered_at: string;
    user_id: string;
  }> {
    return stmt(`
      SELECT yp.game_id, g.title AS game_title, yp.playlist_id, yp.discovered_at, yp.user_id
      FROM game_yt_playlists yp
      JOIN games g ON g.id = yp.game_id
      ORDER BY yp.discovered_at DESC
    `).all() as Array<{
      game_id: string;
      game_title: string;
      playlist_id: string;
      discovered_at: string;
      user_id: string;
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
      target_track_count: parseInt(map.target_track_count ?? String(DEFAULT_TRACK_COUNT), 10),
      youtube_playlist_id: map.youtube_playlist_id ?? "",
      anti_spoiler_enabled: map.anti_spoiler_enabled === "1",
      allow_long_tracks: map.allow_long_tracks === "1",
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
