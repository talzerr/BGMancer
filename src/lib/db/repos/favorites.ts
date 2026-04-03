import { getDB } from "@/lib/db";
import { favoriteGames } from "@/lib/db/drizzle-schema";
import { eq, and } from "drizzle-orm";

export const Favorites = {
  async listByUser(userId: string): Promise<string[]> {
    const rows = await getDB()
      .select({ gameId: favoriteGames.game_id })
      .from(favoriteGames)
      .where(eq(favoriteGames.user_id, userId))
      .orderBy(favoriteGames.created_at)
      .all();
    return rows.map((r) => r.gameId);
  },

  async toggle(userId: string, gameId: string): Promise<boolean> {
    const db = getDB();
    const existing = await db
      .select({ gameId: favoriteGames.game_id })
      .from(favoriteGames)
      .where(and(eq(favoriteGames.user_id, userId), eq(favoriteGames.game_id, gameId)))
      .get();

    if (existing) {
      await db
        .delete(favoriteGames)
        .where(and(eq(favoriteGames.user_id, userId), eq(favoriteGames.game_id, gameId)));
      return false;
    }

    await db.insert(favoriteGames).values({ user_id: userId, game_id: gameId });
    return true;
  },
};
