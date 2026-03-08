// Restores the database from a JSON snapshot file.
// Usage: npm run db:restore [-- path/to/snapshot.json]
//        If no path is given, uses the most recently modified file in snapshots/.
//
// WARNING: This will drop all existing data before restoring.

const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");

// ── Resolve snapshot path ────────────────────────────────────────────────────

const snapshotsDir = path.join(process.cwd(), "snapshots");

let snapshotPath = process.argv[2];

if (!snapshotPath) {
  if (!fs.existsSync(snapshotsDir)) {
    console.error("No snapshots/ directory found. Run db:snapshot first.");
    process.exit(1);
  }
  const files = fs
    .readdirSync(snapshotsDir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => ({
      name: f,
      mtime: fs.statSync(path.join(snapshotsDir, f)).mtimeMs,
    }))
    .sort((a, b) => b.mtime - a.mtime);

  if (files.length === 0) {
    console.error("No snapshot files found in snapshots/.");
    process.exit(1);
  }

  snapshotPath = path.join(snapshotsDir, files[0].name);
  console.log(`Using latest snapshot: ${files[0].name}`);
}

if (!fs.existsSync(snapshotPath)) {
  console.error(`Snapshot file not found: ${snapshotPath}`);
  process.exit(1);
}

const snapshot = JSON.parse(fs.readFileSync(snapshotPath, "utf8"));
const { games = [], playlist_tracks = [], game_yt_playlists = [], config = [] } = snapshot;

// ── Open DB and restore ──────────────────────────────────────────────────────

const dbPath =
  process.env.SQLITE_PATH ?? path.join(process.cwd(), "bgmancer.db");

const db = new Database(dbPath);

db.exec(`
  PRAGMA foreign_keys = OFF;
  DROP TABLE IF EXISTS playlist_tracks;
  DROP TABLE IF EXISTS game_yt_playlists;
  DROP TABLE IF EXISTS games;
  DROP TABLE IF EXISTS config;
  PRAGMA foreign_keys = ON;
`);

// Recreate schema (keep in sync with src/lib/db/index.ts initSchema)
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

  CREATE INDEX IF NOT EXISTS idx_tracks_game ON playlist_tracks(game_id);
  CREATE INDEX IF NOT EXISTS idx_tracks_position ON playlist_tracks(position);
  CREATE INDEX IF NOT EXISTS idx_tracks_status ON playlist_tracks(status);

  CREATE TABLE IF NOT EXISTS game_yt_playlists (
    game_id       TEXT NOT NULL PRIMARY KEY,
    playlist_id   TEXT NOT NULL,
    discovered_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS config (
    key   TEXT NOT NULL PRIMARY KEY,
    value TEXT NOT NULL
  );
`);

// ── Insert data ──────────────────────────────────────────────────────────────

const insertGame = db.prepare(`
  INSERT OR REPLACE INTO games
    (id, title, vibe_preference, allow_full_ost, enabled, steam_appid, playtime_minutes, created_at, updated_at)
  VALUES
    (@id, @title, @vibe_preference, @allow_full_ost, @enabled, @steam_appid, @playtime_minutes, @created_at, @updated_at)
`);

const insertTrack = db.prepare(`
  INSERT OR REPLACE INTO playlist_tracks
    (id, game_id, track_name, video_id, video_title, channel_title, thumbnail, search_queries,
     duration_seconds, position, status, error_message, created_at, synced_at)
  VALUES
    (@id, @game_id, @track_name, @video_id, @video_title, @channel_title, @thumbnail, @search_queries,
     @duration_seconds, @position, @status, @error_message, @created_at, @synced_at)
`);

const insertYtPlaylist = db.prepare(`
  INSERT OR REPLACE INTO game_yt_playlists (game_id, playlist_id, discovered_at)
  VALUES (@game_id, @playlist_id, @discovered_at)
`);

const insertConfig = db.prepare(`
  INSERT OR REPLACE INTO config (key, value) VALUES (@key, @value)
`);

const restore = db.transaction(() => {
  for (const row of games) insertGame.run(row);
  for (const row of playlist_tracks) insertTrack.run(row);
  for (const row of game_yt_playlists) insertYtPlaylist.run(row);
  for (const row of config) insertConfig.run(row);
});

restore();
db.close();

console.log(`Restored from: ${path.relative(process.cwd(), snapshotPath)}`);
console.log(
  `  ${games.length} games, ${playlist_tracks.length} tracks, ${game_yt_playlists.length} cached playlists, ${config.length} config rows`
);
