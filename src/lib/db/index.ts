import Database from "better-sqlite3";
import fs from "fs";
import path from "path";

// Stable UUID for the single local user — burned in so INSERT OR IGNORE is idempotent.
export const LOCAL_USER_ID = "01960000-0000-7000-8000-000000000001";

let _db: Database.Database | null = null;

export function getDB(): Database.Database {
  if (!_db) {
    const dbPath = process.env.SQLITE_PATH ?? path.join(process.cwd(), "bgmancer.db");
    _db = new Database(dbPath);
    _db.pragma("journal_mode = WAL");
    _db.pragma("foreign_keys = ON");
    initSchema(_db);
    seedDefaultUser(_db);
    syncYtPlaylistSeeds(_db);
  }
  return _db;
}

function initSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id         TEXT NOT NULL PRIMARY KEY,
      email      TEXT NOT NULL UNIQUE,
      username   TEXT,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
    );

    CREATE TABLE IF NOT EXISTS games (
      id               TEXT    NOT NULL PRIMARY KEY,
      title            TEXT    NOT NULL,
      vibe_preference  TEXT    NOT NULL,
      allow_full_ost   INTEGER NOT NULL DEFAULT 0,
      enabled          INTEGER NOT NULL DEFAULT 1,
      steam_appid      INTEGER,
      playtime_minutes INTEGER,
      created_at       TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
      updated_at       TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
    );

    CREATE INDEX IF NOT EXISTS idx_games_created ON games(created_at);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_games_steam_appid ON games(steam_appid) WHERE steam_appid IS NOT NULL;

    CREATE TABLE IF NOT EXISTS playlists (
      id          TEXT NOT NULL PRIMARY KEY,
      user_id     TEXT NOT NULL,
      name        TEXT NOT NULL,
      description TEXT,
      is_archived INTEGER NOT NULL DEFAULT 0,
      created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_playlists_user    ON playlists(user_id);
    CREATE INDEX IF NOT EXISTS idx_playlists_created ON playlists(created_at);

    CREATE TABLE IF NOT EXISTS playlist_tracks (
      id               TEXT    NOT NULL PRIMARY KEY,
      playlist_id      TEXT    NOT NULL,
      game_id          TEXT    NOT NULL,
      track_name       TEXT,
      video_id         TEXT,
      video_title      TEXT,
      channel_title    TEXT,
      thumbnail        TEXT,
      search_queries   TEXT,
      duration_seconds INTEGER,
      position         INTEGER NOT NULL DEFAULT 0,
      status           TEXT    NOT NULL DEFAULT 'pending',
      error_message    TEXT,
      created_at       TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
      synced_at        TEXT,
      FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE,
      FOREIGN KEY (game_id)     REFERENCES games(id)     ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_tracks_playlist  ON playlist_tracks(playlist_id);
    CREATE INDEX IF NOT EXISTS idx_tracks_game      ON playlist_tracks(game_id);
    CREATE INDEX IF NOT EXISTS idx_tracks_position  ON playlist_tracks(position);
    CREATE INDEX IF NOT EXISTS idx_tracks_status    ON playlist_tracks(status);

    CREATE TABLE IF NOT EXISTS game_yt_playlists (
      game_id       TEXT NOT NULL PRIMARY KEY,
      playlist_id   TEXT NOT NULL,
      discovered_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
      FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS config (
      key        TEXT NOT NULL PRIMARY KEY,
      value      TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
    );

    INSERT OR IGNORE INTO config (key, value) VALUES ('target_track_count', '50');
    INSERT OR IGNORE INTO config (key, value) VALUES ('youtube_playlist_id', '');
  `);
}

function seedDefaultUser(db: Database.Database): void {
  db.prepare(
    "INSERT OR IGNORE INTO users (id, email, username) VALUES (?, 'local@bgmancer.app', 'Local')",
  ).run(LOCAL_USER_ID);
}

type YtPlaylistEntry = { game_title: string; playlist_id: string };

function loadYtPlaylistSeedFile(): YtPlaylistEntry[] {
  const seedPath = path.join(process.cwd(), "data", "yt-playlists.json");
  if (!fs.existsSync(seedPath)) return [];
  return JSON.parse(fs.readFileSync(seedPath, "utf-8")) as YtPlaylistEntry[];
}

/**
 * On every startup, upserts all yt-playlists.json entries into game_yt_playlists
 * for any games that already exist in the DB. This ensures the table stays in sync
 * whenever new entries are added to the seed file without requiring a game re-import.
 */
function syncYtPlaylistSeeds(db: Database.Database): void {
  const entries = loadYtPlaylistSeedFile();
  if (entries.length === 0) return;

  // INSERT ... SELECT so we only touch rows whose game title exists in the games table,
  // naturally respecting the FK constraint without needing to look up IDs first.
  const upsertSQL = `
    INSERT INTO game_yt_playlists (game_id, playlist_id)
    SELECT g.id, ?
    FROM games g
    WHERE g.title = ?
    ON CONFLICT(game_id) DO UPDATE SET
      playlist_id   = excluded.playlist_id,
      discovered_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
  `;

  db.transaction(() => {
    const upsert = db.prepare(upsertSQL);
    for (const { game_title, playlist_id } of entries) {
      upsert.run(playlist_id, game_title);
    }
  })();
}

let _seedMap: Map<string, string> | null = null;

/**
 * Returns the seeded YouTube playlist ID for a game title, or null if none.
 * Used at game-creation time so newly added games are seeded immediately
 * without waiting for the next restart.
 */
export function getSeedPlaylistId(gameTitle: string): string | null {
  if (!_seedMap) {
    _seedMap = new Map(loadYtPlaylistSeedFile().map((e) => [e.game_title, e.playlist_id]));
  }
  return _seedMap.get(gameTitle) ?? null;
}
