import fs from "fs";
import path from "path";
import type Database from "better-sqlite3";

export const LOCAL_USER_ID = "01960000-0000-7000-8000-000000000001";
export const LOCAL_LIBRARY_ID = "01960000-0000-7000-8000-000000000002";

type YtPlaylistEntry = { game_title: string; playlist_id: string };

export function loadYtPlaylistSeedFile(): YtPlaylistEntry[] {
  const seedPath = path.join(process.cwd(), "data", "yt-playlists.json");
  if (!fs.existsSync(seedPath)) return [];
  return JSON.parse(fs.readFileSync(seedPath, "utf-8")) as YtPlaylistEntry[];
}

export function seedDefaultUser(db: Database.Database): void {
  db.prepare(
    "INSERT OR IGNORE INTO users (id, email, username, tier) VALUES (?, 'local@bgmancer.app', 'Local', 'bard')",
  ).run(LOCAL_USER_ID);
  db.prepare("INSERT OR IGNORE INTO libraries (id, user_id) VALUES (?, ?)").run(
    LOCAL_LIBRARY_ID,
    LOCAL_USER_ID,
  );
}

/**
 * On every startup, upserts all yt-playlists.json entries into game_yt_playlists
 * for any games that already exist in the DB. This ensures the table stays in sync
 * whenever new entries are added to the seed file without requiring a game re-import.
 */
export function syncYtPlaylistSeeds(db: Database.Database): void {
  const entries = loadYtPlaylistSeedFile();
  if (entries.length === 0) return;

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
