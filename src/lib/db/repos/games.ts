import { getDB } from "@/lib/db";
import { stmt, LIBRARY_SQ } from "./_shared";
import { toGame, toGames } from "@/lib/db/mappers";
import { CurationMode } from "@/types";
import type { Game } from "@/types";
import { YT_IMPORT_GAME_ID, steamHeaderUrl } from "@/lib/constants";

export const Games = {
  /** Returns all non-skip published games in the user's library — used for playlist generation. */
  listAll(userId: string, excludeId?: string): Game[] {
    const base = `
      SELECT g.*, lg.curation FROM games g
      JOIN library_games lg ON lg.game_id = g.id
      WHERE lg.library_id = ${LIBRARY_SQ}
        AND lg.curation != 'skip'
        AND g.published = 1
    `;
    if (excludeId) {
      return toGames(stmt(`${base} AND g.id != ? ORDER BY lg.added_at ASC`).all(userId, excludeId));
    }
    return toGames(stmt(`${base} ORDER BY lg.added_at ASC`).all(userId));
  },

  /** Returns all published games in the user's library regardless of curation — used by the library page. */
  listAllIncludingDisabled(userId: string): Game[] {
    return toGames(
      stmt(`
        SELECT g.*, lg.curation FROM games g
        JOIN library_games lg ON lg.game_id = g.id
        WHERE lg.library_id = ${LIBRARY_SQ}
          AND g.published = 1
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

  findByTitle(title: string): Game | null {
    const row = stmt("SELECT * FROM games WHERE lower(title) = lower(?)").get(title) as
      | Record<string, unknown>
      | undefined;
    return row ? toGame(row) : null;
  },

  getById(id: string): Game | null {
    const row = stmt("SELECT * FROM games WHERE id = ?").get(id) as
      | Record<string, unknown>
      | undefined;
    return row ? toGame(row) : null;
  },

  /** Returns a game with its curation value scoped to the given user's library. */
  getByIdForUser(userId: string, id: string): Game | null {
    const row = stmt(`
      SELECT g.*, lg.curation FROM games g
      JOIN library_games lg ON lg.game_id = g.id
      WHERE g.id = ? AND lg.library_id = ${LIBRARY_SQ}
    `).get(id, userId) as Record<string, unknown> | undefined;
    return row ? toGame(row) : null;
  },

  create(
    userId: string,
    id: string,
    title: string,
    curation: CurationMode = CurationMode.Include,
    steamAppid: number | null = null,
  ): Game {
    const db = getDB();
    const thumbnail = steamAppid ? steamHeaderUrl(steamAppid) : null;
    db.transaction(() => {
      stmt("INSERT INTO games (id, title, steam_appid, thumbnail_url) VALUES (?, ?, ?, ?)").run(
        id,
        title,
        steamAppid,
        thumbnail,
      );

      stmt(
        `INSERT OR IGNORE INTO library_games (library_id, game_id, curation) VALUES (${LIBRARY_SQ}, ?, ?)`,
      ).run(userId, id, curation);
    })();

    const created = this.getByIdForUser(userId, id);
    if (!created) throw new Error(`[Games.create] game ${id} not found after INSERT`);
    return created;
  },

  linkToLibrary(userId: string, gameId: string, curation = CurationMode.Include): void {
    stmt(
      `INSERT OR IGNORE INTO library_games (library_id, game_id, curation) VALUES (${LIBRARY_SQ}, ?, ?)`,
    ).run(userId, gameId, curation);
  },

  setCuration(userId: string, gameId: string, curation: CurationMode): void {
    stmt(
      `UPDATE library_games SET curation = ? WHERE library_id = ${LIBRARY_SQ} AND game_id = ?`,
    ).run(curation, userId, gameId);
  },

  /** Removes the game from the user's library. Only unlinks — never deletes the game record. */
  remove(userId: string, id: string): void {
    stmt(`DELETE FROM library_games WHERE library_id = ${LIBRARY_SQ} AND game_id = ?`).run(
      userId,
      id,
    );
  },

  ensureExists(userId: string, id: string, title: string): void {
    const exists = stmt("SELECT id FROM games WHERE id = ?").get(id);
    if (!exists) {
      this.create(userId, id, title, CurationMode.Skip);
    } else {
      this.linkToLibrary(userId, id, CurationMode.Skip);
    }
  },
};
