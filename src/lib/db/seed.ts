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
 * On every startup, seeds yt_playlist_id on games that match titles in yt-playlists.json.
 * Only sets the column if it is not already set, so runtime-discovered values are preserved.
 */
export function syncYtPlaylistSeeds(db: Database.Database): void {
  const entries = loadYtPlaylistSeedFile();
  if (entries.length === 0) return;

  db.transaction(() => {
    const update = db.prepare(
      "UPDATE games SET yt_playlist_id = ? WHERE title = ? AND yt_playlist_id IS NULL",
    );
    for (const { game_title, playlist_id } of entries) {
      update.run(playlist_id, game_title);
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
