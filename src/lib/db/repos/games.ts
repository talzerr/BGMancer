import { getDB } from "@/lib/db";
import { getSeedPlaylistId } from "@/lib/db/seed";
import { stmt, LIBRARY_SQ } from "./_shared";
import { toGame, toGames } from "@/lib/db/mappers";
import { CurationMode } from "@/types";
import type { TaggingStatus } from "@/types";
import type { Game } from "@/types";
import { newId } from "@/lib/uuid";
import { YT_IMPORT_GAME_ID } from "@/lib/constants";

export interface GameUpdateFields {
  curation?: CurationMode;
  tracklist_source?: string | null;
  needs_review?: boolean;
}

export interface SteamGameInput {
  appid: number;
  name: string;
  playtime_forever: number;
}

export const Games = {
  /** Returns all non-skip games in the user's library — used for playlist generation. */
  listAll(userId: string, excludeId?: string): Game[] {
    const base = `
      SELECT g.* FROM games g
      JOIN library_games lg ON lg.game_id = g.id
      WHERE lg.library_id = ${LIBRARY_SQ}
        AND g.curation != 'skip'
    `;
    if (excludeId) {
      return toGames(stmt(`${base} AND g.id != ? ORDER BY lg.added_at ASC`).all(userId, excludeId));
    }
    return toGames(stmt(`${base} ORDER BY lg.added_at ASC`).all(userId));
  },

  /** Returns all games in the user's library regardless of curation — used by the library page. */
  listAllIncludingDisabled(userId: string): Game[] {
    return toGames(
      stmt(`
        SELECT g.* FROM games g
        JOIN library_games lg ON lg.game_id = g.id
        WHERE lg.library_id = ${LIBRARY_SQ}
        ORDER BY lg.added_at ASC
      `).all(userId),
    );
  },

  /** Returns the number of real games in the user's library, excluding the synthetic YT-import entry. */
  count(userId: string): number {
    const row = stmt(`
      SELECT COUNT(*) AS cnt FROM games g
      JOIN library_games lg ON lg.game_id = g.id
      WHERE lg.library_id = ${LIBRARY_SQ}
        AND g.id != '${YT_IMPORT_GAME_ID}'
    `).get(userId) as { cnt: number };
    return row.cnt;
  },

  getById(id: string): Game | null {
    const row = stmt("SELECT * FROM games WHERE id = ?").get(id) as
      | Record<string, unknown>
      | undefined;
    return row ? toGame(row) : null;
  },

  create(
    userId: string,
    id: string,
    title: string,
    curation: CurationMode = CurationMode.Include,
    steamAppid: number | null = null,
    playtimeMinutes: number | null = null,
  ): Game {
    const db = getDB();
    const seededPlaylistId = getSeedPlaylistId(title);
    db.transaction(() => {
      stmt(
        "INSERT INTO games (id, title, curation, steam_appid, playtime_minutes, yt_playlist_id) VALUES (?, ?, ?, ?, ?, ?)",
      ).run(id, title, curation, steamAppid, playtimeMinutes, seededPlaylistId ?? null);

      stmt(
        `INSERT OR IGNORE INTO library_games (library_id, game_id) VALUES (${LIBRARY_SQ}, ?)`,
      ).run(userId, id);
    })();

    const created = this.getById(id);
    if (!created) throw new Error(`[Games.create] game ${id} not found after INSERT`);
    return created;
  },

  setPlaylistId(id: string, playlistId: string): void {
    stmt("UPDATE games SET yt_playlist_id = ? WHERE id = ?").run(playlistId, id);
  },

  setStatus(id: string, status: TaggingStatus): void {
    stmt(
      `UPDATE games SET tagging_status = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = ?`,
    ).run(status, id);
  },

  update(id: string, fields: GameUpdateFields): Game | null {
    if (fields.curation !== undefined) {
      stmt(
        `UPDATE games SET curation = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = ?`,
      ).run(fields.curation, id);
    }
    if (fields.tracklist_source !== undefined) {
      stmt(
        `UPDATE games SET tracklist_source = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = ?`,
      ).run(fields.tracklist_source, id);
    }
    if (fields.needs_review !== undefined) {
      stmt(
        `UPDATE games SET needs_review = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = ?`,
      ).run(fields.needs_review ? 1 : 0, id);
    }
    return this.getById(id);
  },

  /** Removes the game from the user's library (and deletes the game row if it has no other library entries). */
  remove(userId: string, id: string): void {
    const db = getDB();
    db.transaction(() => {
      stmt(`DELETE FROM library_games WHERE library_id = ${LIBRARY_SQ} AND game_id = ?`).run(
        userId,
        id,
      );
      const remaining = stmt("SELECT COUNT(*) AS cnt FROM library_games WHERE game_id = ?").get(
        id,
      ) as { cnt: number };
      if (remaining.cnt === 0) {
        stmt("DELETE FROM games WHERE id = ?").run(id);
      }
    })();
  },

  ensureExists(userId: string, id: string, title: string): void {
    const exists = stmt("SELECT id FROM games WHERE id = ?").get(id);
    if (!exists) {
      this.create(userId, id, title, CurationMode.Skip);
    } else {
      // Ensure it's in this user's library (idempotent)
      stmt(
        `INSERT OR IGNORE INTO library_games (library_id, game_id) VALUES (${LIBRARY_SQ}, ?)`,
      ).run(userId, id);
    }
  },

  /**
   * Bulk-inserts Steam games as disabled (curation='skip') into the user's library.
   * Silently skips entries whose steam_appid already exists (via the unique index).
   * Returns the count of newly inserted and skipped rows.
   */
  bulkImportSteam(
    userId: string,
    games: SteamGameInput[],
  ): { imported: number; skipped: number; importedIds: string[] } {
    const db = getDB();
    const insertGameSQL = `
      INSERT OR IGNORE INTO games
        (id, title, curation, steam_appid, playtime_minutes, yt_playlist_id)
      VALUES (?, ?, 'skip', ?, ?, ?)
    `;
    const insertLibrarySQL = `INSERT OR IGNORE INTO library_games (library_id, game_id) VALUES (${LIBRARY_SQ}, ?)`;

    let imported = 0;
    let skipped = 0;
    const importedIds: string[] = [];

    db.transaction(() => {
      for (const g of games) {
        const id = newId();
        const seededPlaylistId = getSeedPlaylistId(g.name);
        const result = stmt(insertGameSQL).run(
          id,
          g.name,
          g.appid,
          Math.round(g.playtime_forever),
          seededPlaylistId ?? null,
        );
        if (result.changes > 0) {
          imported++;
          importedIds.push(id);
          stmt(insertLibrarySQL).run(userId, id);
        } else {
          skipped++;
        }
      }
    })();

    return { imported, skipped, importedIds };
  },
};
