import { getDB, batch } from "@/lib/db";
import { eq, asc, count } from "drizzle-orm";
import { gameReviewFlags, games } from "@/lib/db/drizzle-schema";
import { sql } from "drizzle-orm";
import type { ReviewReason } from "@/types";

export interface ReviewFlag {
  id: number;
  gameId: string;
  reason: ReviewReason;
  detail: string | null;
  createdAt: string;
}

function rowToFlag(row: typeof gameReviewFlags.$inferSelect): ReviewFlag {
  return {
    id: row.id,
    gameId: row.game_id,
    reason: row.reason as ReviewReason,
    detail: row.detail,
    createdAt: row.created_at,
  };
}

export const ReviewFlags = {
  async markAsNeedsReview(gameId: string, reason: ReviewReason, detail?: string): Promise<void> {
    await batch([
      getDB()
        .insert(gameReviewFlags)
        .values({ game_id: gameId, reason, detail: detail ?? null }),
      getDB()
        .update(games)
        .set({
          needs_review: true,
          updated_at: sql`strftime('%Y-%m-%dT%H:%M:%SZ', 'now')`,
        })
        .where(eq(games.id, gameId)),
    ]);
  },

  async listByGame(gameId: string): Promise<ReviewFlag[]> {
    const rows = await getDB()
      .select()
      .from(gameReviewFlags)
      .where(eq(gameReviewFlags.game_id, gameId))
      .orderBy(asc(gameReviewFlags.created_at))
      .all();
    return rows.map(rowToFlag);
  },

  async dismiss(flagId: number, gameId: string): Promise<void> {
    const db = getDB();
    await db.delete(gameReviewFlags).where(eq(gameReviewFlags.id, flagId)).run();
    const remaining = (await db
      .select({ cnt: count() })
      .from(gameReviewFlags)
      .where(eq(gameReviewFlags.game_id, gameId))
      .get()) ?? { cnt: 0 };
    if (remaining.cnt === 0) {
      await db
        .update(games)
        .set({
          needs_review: false,
          updated_at: sql`strftime('%Y-%m-%dT%H:%M:%SZ', 'now')`,
        })
        .where(eq(games.id, gameId))
        .run();
    }
  },

  async clearByGame(gameId: string): Promise<void> {
    await batch([
      getDB().delete(gameReviewFlags).where(eq(gameReviewFlags.game_id, gameId)),
      getDB()
        .update(games)
        .set({
          needs_review: false,
          updated_at: sql`strftime('%Y-%m-%dT%H:%M:%SZ', 'now')`,
        })
        .where(eq(games.id, gameId)),
    ]);
  },
};
