import Database from "better-sqlite3";
import fs from "fs";
import path from "path";

let _db: Database.Database | null = null;

export function getDB(): Database.Database {
  if (!_db) {
    const dbPath = process.env.SQLITE_PATH ?? path.join(process.cwd(), "bgmancer.db");
    _db = new Database(dbPath);
    _db.pragma("journal_mode = WAL");
    _db.pragma("foreign_keys = ON");
    initSchema(_db);
  }
  return _db;
}

function initSchema(db: Database.Database): void {
  db.exec(`
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

    CREATE TABLE IF NOT EXISTS playlist_tracks (
      id               TEXT    NOT NULL PRIMARY KEY,
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
      FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_tracks_game     ON playlist_tracks(game_id);
    CREATE INDEX IF NOT EXISTS idx_tracks_position ON playlist_tracks(position);
    CREATE INDEX IF NOT EXISTS idx_tracks_status   ON playlist_tracks(status);

    CREATE TABLE IF NOT EXISTS game_yt_playlists (
      game_id      TEXT NOT NULL PRIMARY KEY,
      playlist_id  TEXT NOT NULL,
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

let _seedMap: Map<string, string> | null = null;

/**
 * Returns the seeded YouTube playlist ID for a game title, or null if none.
 * The seed file is loaded once and cached for the lifetime of the process.
 */
export function getSeedPlaylistId(gameTitle: string): string | null {
  if (!_seedMap) {
    const seedPath = path.join(process.cwd(), "data", "yt-playlists.json");
    if (!fs.existsSync(seedPath)) {
      _seedMap = new Map();
    } else {
      const entries: Array<{ game_title: string; playlist_id: string }> = JSON.parse(
        fs.readFileSync(seedPath, "utf-8"),
      );
      _seedMap = new Map(entries.map((e) => [e.game_title, e.playlist_id]));
    }
  }
  return _seedMap.get(gameTitle) ?? null;
}
