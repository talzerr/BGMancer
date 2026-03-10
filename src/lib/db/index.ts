import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { DEFAULT_TRACK_COUNT } from "@/lib/constants";

// Stable UUIDs burned in so INSERT OR IGNORE is idempotent.
export const LOCAL_USER_ID = "01960000-0000-7000-8000-000000000001";
export const LOCAL_LIBRARY_ID = "01960000-0000-7000-8000-000000000002";

let _db: Database.Database | null = null;

export function getDB(): Database.Database {
  if (!_db) {
    const dbPath = process.env.SQLITE_PATH ?? path.join(process.cwd(), "bgmancer.db");
    _db = new Database(dbPath);
    _db.pragma("journal_mode = WAL");
    _db.pragma("foreign_keys = ON");
    initSchema(_db);
    migrateSchema(_db);
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
      tier       TEXT NOT NULL DEFAULT 'bard',
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
    );

    CREATE TABLE IF NOT EXISTS games (
      id               TEXT    NOT NULL PRIMARY KEY,
      title            TEXT    NOT NULL,
      allow_full_ost   INTEGER NOT NULL DEFAULT 0,
      curation         TEXT    NOT NULL DEFAULT 'include',
      steam_appid      INTEGER,
      playtime_minutes INTEGER,
      created_at       TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
      updated_at       TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
    );

    CREATE INDEX IF NOT EXISTS idx_games_created ON games(created_at);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_games_steam_appid ON games(steam_appid) WHERE steam_appid IS NOT NULL;

    CREATE TABLE IF NOT EXISTS libraries (
      id         TEXT NOT NULL PRIMARY KEY,
      user_id    TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_libraries_user ON libraries(user_id);

    CREATE TABLE IF NOT EXISTS library_games (
      library_id TEXT NOT NULL,
      game_id    TEXT NOT NULL,
      added_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
      PRIMARY KEY (library_id, game_id),
      FOREIGN KEY (library_id) REFERENCES libraries(id) ON DELETE CASCADE,
      FOREIGN KEY (game_id)    REFERENCES games(id)     ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_library_games_game ON library_games(game_id);

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
      game_id       TEXT NOT NULL,
      user_id       TEXT NOT NULL DEFAULT '',
      playlist_id   TEXT NOT NULL,
      discovered_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
      PRIMARY KEY (game_id, user_id),
      FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS config (
      key        TEXT NOT NULL PRIMARY KEY,
      value      TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
    );

    INSERT OR IGNORE INTO config (key, value) VALUES ('target_track_count', '${DEFAULT_TRACK_COUNT}');
    INSERT OR IGNORE INTO config (key, value) VALUES ('youtube_playlist_id', '');
  `);
}

/**
 * Additive schema migrations — safe to run on every startup.
 * Uses try/catch because SQLite's ADD COLUMN errors if the column already exists.
 */
function migrateSchema(db: Database.Database): void {
  try {
    db.prepare("ALTER TABLE users ADD COLUMN is_generating INTEGER NOT NULL DEFAULT 0").run();
  } catch {
    // column already exists
  }
  try {
    db.prepare("ALTER TABLE users ADD COLUMN last_generated_at TEXT").run();
  } catch {
    // column already exists
  }

  // Migrate game_yt_playlists from single game_id PK to (game_id, user_id) composite PK.
  // '' = global/shared entry; a real user_id = personal override.
  const ytCols = db.prepare("PRAGMA table_info(game_yt_playlists)").all() as Array<{
    name: string;
  }>;
  if (!ytCols.some((c) => c.name === "user_id")) {
    db.transaction(() => {
      db.prepare("ALTER TABLE game_yt_playlists RENAME TO _game_yt_playlists_v1").run();
      db.prepare(
        `
        CREATE TABLE game_yt_playlists (
          game_id       TEXT NOT NULL,
          user_id       TEXT NOT NULL DEFAULT '',
          playlist_id   TEXT NOT NULL,
          discovered_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
          PRIMARY KEY (game_id, user_id),
          FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
        )
      `,
      ).run();
      db.prepare(
        "INSERT OR IGNORE INTO game_yt_playlists (game_id, user_id, playlist_id, discovered_at) SELECT game_id, '', playlist_id, discovered_at FROM _game_yt_playlists_v1",
      ).run();
      db.prepare("DROP TABLE _game_yt_playlists_v1").run();
    })();
  }
}

function seedDefaultUser(db: Database.Database): void {
  db.prepare(
    "INSERT OR IGNORE INTO users (id, email, username, tier) VALUES (?, 'local@bgmancer.app', 'Local', 'bard')",
  ).run(LOCAL_USER_ID);
  db.prepare("INSERT OR IGNORE INTO libraries (id, user_id) VALUES (?, ?)").run(
    LOCAL_LIBRARY_ID,
    LOCAL_USER_ID,
  );
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
    INSERT INTO game_yt_playlists (game_id, user_id, playlist_id)
    SELECT g.id, '', ?
    FROM games g
    WHERE g.title = ?
    ON CONFLICT(game_id, user_id) DO UPDATE SET
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
