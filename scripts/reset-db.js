// Drops all tables and lets the app recreate the schema on next server start.
// Usage: npm run db:reset
// WARNING: All data will be lost.

const Database = require("better-sqlite3");
const path = require("path");

const dbPath = process.env.SQLITE_PATH ?? path.join(process.cwd(), "bgmancer.db");

const db = new Database(dbPath);

db.exec(`
  PRAGMA foreign_keys = OFF;
  DROP TABLE IF EXISTS playlist_tracks;
  DROP TABLE IF EXISTS game_yt_playlists;
  DROP TABLE IF EXISTS games;
  DROP TABLE IF EXISTS config;
  PRAGMA foreign_keys = ON;
`);

db.close();

console.log("Database reset. Tables will be recreated on next server start.");
