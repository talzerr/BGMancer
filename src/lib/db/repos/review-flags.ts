import { stmt } from "./_shared";
import { getDB } from "@/lib/db";
import type { ReviewReason } from "@/types";

export interface ReviewFlag {
  id: number;
  gameId: string;
  reason: ReviewReason;
  detail: string | null;
  createdAt: string;
}

function toReviewFlag(row: Record<string, unknown>): ReviewFlag {
  return {
    id: Number(row.id),
    gameId: String(row.game_id),
    reason: row.reason as ReviewReason,
    detail: row.detail != null ? String(row.detail) : null,
    createdAt: String(row.created_at ?? ""),
  };
}

export const ReviewFlags = {
  /** Inserts a review flag and atomically marks the game as needs_review. A game may accumulate multiple flags. */
  markAsNeedsReview(gameId: string, reason: ReviewReason, detail?: string): void {
    getDB().transaction(() => {
      stmt("INSERT INTO game_review_flags (game_id, reason, detail) VALUES (?, ?, ?)").run(
        gameId,
        reason,
        detail ?? null,
      );
      stmt(
        `UPDATE games SET needs_review = 1, updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = ?`,
      ).run(gameId);
    })();
  },

  listByGame(gameId: string): ReviewFlag[] {
    const rows = stmt("SELECT * FROM game_review_flags WHERE game_id = ? ORDER BY created_at").all(
      gameId,
    ) as Record<string, unknown>[];
    return rows.map(toReviewFlag);
  },

  /** Clear all review flags for a game and reset needs_review to 0. */
  clearByGame(gameId: string): void {
    getDB().transaction(() => {
      stmt("DELETE FROM game_review_flags WHERE game_id = ?").run(gameId);
      stmt(
        `UPDATE games SET needs_review = 0, updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = ?`,
      ).run(gameId);
    })();
  },
};
