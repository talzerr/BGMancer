import Database from "better-sqlite3";
import path from "path";

let _db: Database.Database | null = null;

export function getDB(): Database.Database {
  if (!_db) {
    const dbPath =
      process.env.SQLITE_PATH ?? path.join(process.cwd(), "bgmancer.db");
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
      id              TEXT    NOT NULL PRIMARY KEY,
      title           TEXT    NOT NULL,
      vibe_preference TEXT    NOT NULL,
      allow_full_ost  INTEGER NOT NULL DEFAULT 0,
      created_at      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
      updated_at      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
    );

    CREATE INDEX IF NOT EXISTS idx_games_created ON games(created_at);

    CREATE TABLE IF NOT EXISTS playlist_tracks (
      id            TEXT    NOT NULL PRIMARY KEY,
      game_id       TEXT    NOT NULL,
      track_name    TEXT,
      video_id      TEXT,
      video_title   TEXT,
      channel_title TEXT,
      thumbnail     TEXT,
      search_queries TEXT,
      position      INTEGER NOT NULL DEFAULT 0,
      status        TEXT    NOT NULL DEFAULT 'pending',
      error_message TEXT,
      created_at    TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
      synced_at     TEXT,
      FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_tracks_game     ON playlist_tracks(game_id);
    CREATE INDEX IF NOT EXISTS idx_tracks_position ON playlist_tracks(position);
    CREATE INDEX IF NOT EXISTS idx_tracks_status   ON playlist_tracks(status);

    CREATE TABLE IF NOT EXISTS config (
      key        TEXT NOT NULL PRIMARY KEY,
      value      TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
    );

    INSERT OR IGNORE INTO config (key, value) VALUES ('target_track_count', '50');
    INSERT OR IGNORE INTO config (key, value) VALUES ('youtube_playlist_id', '');
  `);
}
