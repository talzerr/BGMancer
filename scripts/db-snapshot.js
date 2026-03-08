// Exports the current database state to a JSON snapshot file.
// Usage: npm run db:snapshot [-- --name my-snapshot]
//        Creates: snapshots/<name|timestamp>.json

const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");

const dbPath =
  process.env.SQLITE_PATH ?? path.join(process.cwd(), "bgmancer.db");

if (!fs.existsSync(dbPath)) {
  console.error(`Database not found at ${dbPath}`);
  process.exit(1);
}

const db = new Database(dbPath, { readonly: true });

const nameArg = process.argv.indexOf("--name");
const snapshotName =
  nameArg !== -1 && process.argv[nameArg + 1]
    ? process.argv[nameArg + 1]
    : new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);

const snapshotsDir = path.join(process.cwd(), "snapshots");
fs.mkdirSync(snapshotsDir, { recursive: true });

const outPath = path.join(snapshotsDir, `${snapshotName}.json`);

const snapshot = {
  created_at: new Date().toISOString(),
  games: db.prepare("SELECT * FROM games").all(),
  playlist_tracks: db.prepare("SELECT * FROM playlist_tracks").all(),
  game_yt_playlists: db.prepare("SELECT * FROM game_yt_playlists").all(),
  config: db.prepare("SELECT * FROM config").all(),
};

db.close();

fs.writeFileSync(outPath, JSON.stringify(snapshot, null, 2));

console.log(`Snapshot saved → ${path.relative(process.cwd(), outPath)}`);
console.log(
  `  ${snapshot.games.length} games, ${snapshot.playlist_tracks.length} tracks, ${snapshot.game_yt_playlists.length} cached playlists, ${snapshot.config.length} config rows`
);
