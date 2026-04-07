import { getDB } from "@/lib/db";
import { sql, inArray, and, eq } from "drizzle-orm";
import { games as gamesTable } from "@/lib/db/drizzle-schema";
import { toGame, toGames } from "@/lib/db/mappers";
import { CurationMode } from "@/types";
import type { Game } from "@/types";
import { LIBRARY_MAX_GAMES, YT_IMPORT_GAME_ID, steamHeaderUrl } from "@/lib/constants";

export const Games = {
  async listAll(userId: string, excludeId?: string): Promise<Game[]> {
    const db = getDB();
    if (excludeId) {
      return toGames(
        await db.all(sql`
          SELECT g.*, lg.curation FROM games g
          JOIN library_games lg ON lg.game_id = g.id
          WHERE lg.library_id = (SELECT id FROM libraries WHERE user_id = ${userId} LIMIT 1)
            AND g.published = 1
            AND g.id != ${excludeId}
          ORDER BY lg.added_at ASC
        `),
      );
    }
    return toGames(
      await db.all(sql`
        SELECT g.*, lg.curation FROM games g
        JOIN library_games lg ON lg.game_id = g.id
        WHERE lg.library_id = (SELECT id FROM libraries WHERE user_id = ${userId} LIMIT 1)
          AND g.published = 1
        ORDER BY lg.added_at ASC
      `),
    );
  },

  /** Fetch published games by IDs — no library JOIN. Used for guest generation. */
  async getPublishedByIds(ids: string[]): Promise<Game[]> {
    if (ids.length === 0) return [];
    const rows = await getDB()
      .select()
      .from(gamesTable)
      .where(and(inArray(gamesTable.id, ids), eq(gamesTable.published, true)))
      .all();
    // Guests have no library — default curation to "include".
    return rows.map((r) => toGame({ ...r, curation: CurationMode.Include }));
  },

  async count(userId: string): Promise<number> {
    const row = (await getDB().get<{ cnt: number }>(sql`
      SELECT COUNT(*) AS cnt FROM games g
      JOIN library_games lg ON lg.game_id = g.id
      WHERE lg.library_id = (SELECT id FROM libraries WHERE user_id = ${userId} LIMIT 1)
        AND g.id != ${YT_IMPORT_GAME_ID}
    `))!;
    return row.cnt;
  },

  async findByTitle(title: string): Promise<Game | null> {
    const row = await getDB().get(sql`SELECT * FROM games WHERE lower(title) = lower(${title})`);
    return row ? toGame(row as Record<string, unknown>) : null;
  },

  async getById(id: string): Promise<Game | null> {
    const row = await getDB().get(sql`SELECT * FROM games WHERE id = ${id}`);
    return row ? toGame(row as Record<string, unknown>) : null;
  },

  async getByIdForUser(userId: string, id: string): Promise<Game | null> {
    const row = await getDB().get(sql`
      SELECT g.*, lg.curation FROM games g
      JOIN library_games lg ON lg.game_id = g.id
      WHERE g.id = ${id}
        AND lg.library_id = (SELECT id FROM libraries WHERE user_id = ${userId} LIMIT 1)
    `);
    return row ? toGame(row as Record<string, unknown>) : null;
  },

  async create(
    userId: string,
    id: string,
    title: string,
    curation: CurationMode = CurationMode.Include,
    steamAppid: number | null = null,
  ): Promise<Game> {
    const db = getDB();
    const thumbnail = steamAppid ? steamHeaderUrl(steamAppid) : null;
    await db.run(sql`
      INSERT INTO games (id, title, steam_appid, thumbnail_url) VALUES (${id}, ${title}, ${steamAppid}, ${thumbnail})
    `);
    await db.run(sql`
      INSERT OR IGNORE INTO library_games (library_id, game_id, curation)
      VALUES ((SELECT id FROM libraries WHERE user_id = ${userId} LIMIT 1), ${id}, ${curation})
    `);
    const row = await db.get(sql`
      SELECT g.*, lg.curation FROM games g
      JOIN library_games lg ON lg.game_id = g.id
      WHERE g.id = ${id}
        AND lg.library_id = (SELECT id FROM libraries WHERE user_id = ${userId} LIMIT 1)
    `);
    return toGame(row as Record<string, unknown>);
  },

  async linkToLibrary(
    userId: string,
    gameId: string,
    curation = CurationMode.Include,
  ): Promise<void> {
    await getDB().run(sql`
      INSERT OR IGNORE INTO library_games (library_id, game_id, curation)
      VALUES ((SELECT id FROM libraries WHERE user_id = ${userId} LIMIT 1), ${gameId}, ${curation})
    `);
  },

  /**
   * Cap-enforcing link. Returns false only when a new link was rejected
   * because the user is at LIBRARY_MAX_GAMES; idempotent re-adds return true.
   * The cap check is folded into the INSERT statement so concurrent adds
   * can't both pass.
   *
   * Assumes the verification SELECT reads the same state the INSERT just
   * wrote — true for D1 today (every query goes to the primary). If reads
   * are ever routed to replicas without session bookmarks, the SELECT could
   * land on a stale replica and falsely return false.
   */
  async tryLinkToLibrary(
    userId: string,
    gameId: string,
    curation = CurationMode.Include,
  ): Promise<boolean> {
    await getDB().run(sql`
      INSERT OR IGNORE INTO library_games (library_id, game_id, curation)
      SELECT lib.id, ${gameId}, ${curation}
      FROM libraries lib
      WHERE lib.user_id = ${userId}
        AND (
          SELECT COUNT(*) FROM library_games lg
          JOIN games g ON g.id = lg.game_id
          WHERE lg.library_id = lib.id AND g.id != ${YT_IMPORT_GAME_ID}
        ) < ${LIBRARY_MAX_GAMES}
    `);
    const exists = await getDB().get(sql`
      SELECT 1 AS x FROM library_games
      WHERE library_id = (SELECT id FROM libraries WHERE user_id = ${userId} LIMIT 1)
        AND game_id = ${gameId}
    `);
    return !!exists;
  },

  async setCuration(userId: string, gameId: string, curation: CurationMode): Promise<void> {
    await getDB().run(sql`
      UPDATE library_games SET curation = ${curation}
      WHERE library_id = (SELECT id FROM libraries WHERE user_id = ${userId} LIMIT 1)
        AND game_id = ${gameId}
    `);
  },

  async remove(userId: string, id: string): Promise<void> {
    await getDB().run(sql`
      DELETE FROM library_games
      WHERE library_id = (SELECT id FROM libraries WHERE user_id = ${userId} LIMIT 1)
        AND game_id = ${id}
    `);
  },

  async ensureExists(userId: string, id: string, title: string): Promise<void> {
    const exists = await getDB().get(sql`SELECT id FROM games WHERE id = ${id}`);
    if (!exists) {
      await this.create(userId, id, title, CurationMode.Include);
    } else {
      await this.linkToLibrary(userId, id, CurationMode.Include);
    }
  },
};
