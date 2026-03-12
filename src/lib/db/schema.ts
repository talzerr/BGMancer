import type Database from "better-sqlite3";

export function initSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id                 TEXT    NOT NULL PRIMARY KEY,
      email              TEXT    NOT NULL UNIQUE,
      username           TEXT,
      tier               TEXT    NOT NULL DEFAULT 'bard',
      is_generating      INTEGER NOT NULL DEFAULT 0,
      last_generated_at  TEXT,
      created_at         TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
    );

    CREATE TABLE IF NOT EXISTS games (
      id               TEXT    NOT NULL PRIMARY KEY,
      title            TEXT    NOT NULL,
      allow_full_ost   INTEGER NOT NULL DEFAULT 0,
      curation         TEXT    NOT NULL DEFAULT 'include',
      steam_appid      INTEGER,
      playtime_minutes INTEGER,
      tagging_status   TEXT    NOT NULL DEFAULT 'pending',
      mb_release_id    TEXT,
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

    CREATE TABLE IF NOT EXISTS tracks (
      game_id         TEXT    NOT NULL,
      name            TEXT    NOT NULL,
      position        INTEGER NOT NULL,
      mb_recording_id TEXT,
      energy          INTEGER,
      role            TEXT,
      moods           TEXT,
      instrumentation TEXT,
      has_vocals      INTEGER,
      tagged_at       TEXT,
      PRIMARY KEY (game_id, name),
      FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS video_tracks (
      video_id       TEXT NOT NULL,
      game_id        TEXT NOT NULL,
      track_name     TEXT,
      aligned_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
      PRIMARY KEY (video_id, game_id),
      FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE,
      FOREIGN KEY (game_id, track_name) REFERENCES tracks(game_id, name)
    );

  `);
}
