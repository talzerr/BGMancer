import { describe, it, expect, vi, beforeEach } from "vitest";
import type Database from "better-sqlite3";
import { createTestDB, clearStmtCache, seedTestUser, seedTestGame } from "../../test-helpers";
import { ReviewReason } from "@/types";
let db: Database.Database;

vi.mock("@/lib/db", async () => {
  const { MOCK_LOCAL_USER_ID, MOCK_LOCAL_LIBRARY_ID } = await import("@/test/constants");
  return {
    getDB: () => db,
    LOCAL_USER_ID: MOCK_LOCAL_USER_ID,
    LOCAL_LIBRARY_ID: MOCK_LOCAL_LIBRARY_ID,
  };
});

// Import after mock
const { ReviewFlags } = await import("../review-flags");

let userId: string;
let gameId: string;

beforeEach(() => {
  db = createTestDB();
  clearStmtCache();
  ({ userId } = seedTestUser(db));
  gameId = seedTestGame(db, userId, { id: "game-review" });
});

function getNeedsReview(gId: string): number {
  const row = db.prepare("SELECT needs_review FROM games WHERE id = ?").get(gId) as {
    needs_review: number;
  };
  return row.needs_review;
}

describe("ReviewFlags", () => {
  describe("markAsNeedsReview", () => {
    it("should create a flag and set needs_review to 1", () => {
      ReviewFlags.markAsNeedsReview(gameId, ReviewReason.LlmCallFailed);

      const flags = db
        .prepare("SELECT * FROM game_review_flags WHERE game_id = ?")
        .all(gameId) as Record<string, unknown>[];

      expect(flags).toHaveLength(1);
      expect(flags[0].reason).toBe("llm_call_failed");
      expect(flags[0].game_id).toBe(gameId);
      expect(getNeedsReview(gameId)).toBe(1);
    });

    it("should store the optional detail field", () => {
      ReviewFlags.markAsNeedsReview(gameId, ReviewReason.LowConfidence, "Only 40% confidence");

      const flags = db
        .prepare("SELECT detail FROM game_review_flags WHERE game_id = ?")
        .all(gameId) as Record<string, unknown>[];

      expect(flags[0].detail).toBe("Only 40% confidence");
    });

    it("should set detail to null when not provided", () => {
      ReviewFlags.markAsNeedsReview(gameId, ReviewReason.EmptyMetadata);

      const flags = db
        .prepare("SELECT detail FROM game_review_flags WHERE game_id = ?")
        .all(gameId) as Record<string, unknown>[];

      expect(flags[0].detail).toBeNull();
    });

    it("should allow multiple flags on the same game", () => {
      ReviewFlags.markAsNeedsReview(gameId, ReviewReason.LlmCallFailed);
      ReviewFlags.markAsNeedsReview(gameId, ReviewReason.EmptyMetadata, "no tags");

      const flags = db
        .prepare("SELECT * FROM game_review_flags WHERE game_id = ?")
        .all(gameId) as Record<string, unknown>[];

      expect(flags).toHaveLength(2);
      expect(getNeedsReview(gameId)).toBe(1);
    });
  });

  describe("listByGame", () => {
    it("should return flags ordered by created_at", () => {
      ReviewFlags.markAsNeedsReview(gameId, ReviewReason.LlmCallFailed);
      ReviewFlags.markAsNeedsReview(gameId, ReviewReason.LowConfidence, "second flag");

      const flags = ReviewFlags.listByGame(gameId);

      expect(flags).toHaveLength(2);
      expect(flags[0].reason).toBe(ReviewReason.LlmCallFailed);
      expect(flags[1].reason).toBe(ReviewReason.LowConfidence);
      expect(flags[1].detail).toBe("second flag");
    });

    it("should return an empty array for a game with no flags", () => {
      const flags = ReviewFlags.listByGame(gameId);

      expect(flags).toEqual([]);
    });

    it("should return correctly typed ReviewFlag objects", () => {
      ReviewFlags.markAsNeedsReview(gameId, ReviewReason.NoTracklistSource);

      const [flag] = ReviewFlags.listByGame(gameId);

      expect(typeof flag.id).toBe("number");
      expect(flag.gameId).toBe(gameId);
      expect(typeof flag.createdAt).toBe("string");
    });

    it("should not return flags from a different game", () => {
      const otherGameId = seedTestGame(db, userId, { id: "game-other" });
      ReviewFlags.markAsNeedsReview(gameId, ReviewReason.LlmCallFailed);
      ReviewFlags.markAsNeedsReview(otherGameId, ReviewReason.EmptyMetadata);

      const flags = ReviewFlags.listByGame(gameId);

      expect(flags).toHaveLength(1);
      expect(flags[0].gameId).toBe(gameId);
    });
  });

  describe("dismiss", () => {
    it("should remove the specified flag", () => {
      ReviewFlags.markAsNeedsReview(gameId, ReviewReason.LlmCallFailed);
      const [flag] = ReviewFlags.listByGame(gameId);

      ReviewFlags.dismiss(flag.id, gameId);

      const remaining = ReviewFlags.listByGame(gameId);
      expect(remaining).toHaveLength(0);
    });

    it("should clear needs_review when the last flag is dismissed", () => {
      ReviewFlags.markAsNeedsReview(gameId, ReviewReason.LlmCallFailed);
      const [flag] = ReviewFlags.listByGame(gameId);

      ReviewFlags.dismiss(flag.id, gameId);

      expect(getNeedsReview(gameId)).toBe(0);
    });

    it("should NOT clear needs_review when other flags remain", () => {
      ReviewFlags.markAsNeedsReview(gameId, ReviewReason.LlmCallFailed);
      ReviewFlags.markAsNeedsReview(gameId, ReviewReason.EmptyMetadata);
      const flags = ReviewFlags.listByGame(gameId);

      ReviewFlags.dismiss(flags[0].id, gameId);

      expect(getNeedsReview(gameId)).toBe(1);
      expect(ReviewFlags.listByGame(gameId)).toHaveLength(1);
    });
  });

  describe("clearByGame", () => {
    it("should remove all flags for the game", () => {
      ReviewFlags.markAsNeedsReview(gameId, ReviewReason.LlmCallFailed);
      ReviewFlags.markAsNeedsReview(gameId, ReviewReason.LowConfidence);
      ReviewFlags.markAsNeedsReview(gameId, ReviewReason.EmptyMetadata);

      ReviewFlags.clearByGame(gameId);

      expect(ReviewFlags.listByGame(gameId)).toEqual([]);
    });

    it("should reset needs_review to 0", () => {
      ReviewFlags.markAsNeedsReview(gameId, ReviewReason.LlmCallFailed);
      expect(getNeedsReview(gameId)).toBe(1);

      ReviewFlags.clearByGame(gameId);

      expect(getNeedsReview(gameId)).toBe(0);
    });

    it("should not affect flags on other games", () => {
      const otherGameId = seedTestGame(db, userId, { id: "game-other-clear" });
      ReviewFlags.markAsNeedsReview(gameId, ReviewReason.LlmCallFailed);
      ReviewFlags.markAsNeedsReview(otherGameId, ReviewReason.EmptyMetadata);

      ReviewFlags.clearByGame(gameId);

      expect(ReviewFlags.listByGame(otherGameId)).toHaveLength(1);
      expect(getNeedsReview(otherGameId)).toBe(1);
    });
  });
});
