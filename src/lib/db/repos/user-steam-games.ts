/* eslint-disable @typescript-eslint/no-explicit-any -- Drizzle's batch() API accepts heterogeneous query builder types */
import { getDB } from "@/lib/db";
import { sql, eq } from "drizzle-orm";
import { userSteamGames } from "@/lib/db/drizzle-schema";

export const UserSteamGames = {
  /** Returns the IDs of published catalog games that the user owns on Steam. */
  async getMatchedGameIds(userId: string): Promise<string[]> {
    const rows = await getDB().all<{ id: string }>(sql`
      SELECT g.id FROM games g
      INNER JOIN user_steam_games usg ON g.steam_appid = usg.steam_app_id
      WHERE usg.user_id = ${userId} AND g.published = 1
    `);
    return rows.map((r) => r.id);
  },

  async countMatches(userId: string): Promise<number> {
    const row = (await getDB().get<{ cnt: number }>(sql`
      SELECT COUNT(*) AS cnt FROM games g
      INNER JOIN user_steam_games usg ON g.steam_appid = usg.steam_app_id
      WHERE usg.user_id = ${userId} AND g.published = 1
    `))!;
    return row.cnt;
  },

  /**
   * Returns the delete + insert statements that replace the user's Steam
   * library. The caller is responsible for passing them to `batch()` so the
   * whole replacement happens atomically.
   */
  buildReplaceStatements(
    userId: string,
    games: Array<{ steamAppId: number; playtimeMinutes: number }>,
  ): any[] {
    const db = getDB();
    const stmts: any[] = [db.delete(userSteamGames).where(eq(userSteamGames.user_id, userId))];
    for (const g of games) {
      stmts.push(
        db.insert(userSteamGames).values({
          user_id: userId,
          steam_app_id: g.steamAppId,
          playtime_minutes: g.playtimeMinutes,
        }),
      );
    }
    return stmts;
  },

  async deleteByUserId(userId: string): Promise<void> {
    await getDB().delete(userSteamGames).where(eq(userSteamGames.user_id, userId)).run();
  },
};
