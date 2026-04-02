import { describe, it, expect, vi, beforeEach } from "vitest";
import type Database from "better-sqlite3";
import type { DrizzleDB } from "@/lib/db";
import { createTestDrizzleDB, seedTestUser, seedTestGame } from "../../test-helpers";
import { ReviewReason } from "@/types";
let db: DrizzleDB;
let rawDb: Database.Database;

vi.mock("@/lib/db", async () => {
  const { MOCK_LOCAL_USER_ID, MOCK_LOCAL_LIBRARY_ID } = await import("@/test/constants");
  return {
    getDB: () => db,
    batch: async (queries: any[]) => db.batch(queries),

    LOCAL_USER_ID: MOCK_LOCAL_USER_ID,
    LOCAL_LIBRARY_ID: MOCK_LOCAL_LIBRARY_ID,
  };
});

// Import after mock
const { ReviewFlags } = await import("../review-flags");

let userId: string;
let gameId: string;

beforeEach(() => {
  ({ db, rawDb } = createTestDrizzleDB());
  ({ userId } = seedTestUser(rawDb));
  gameId = seedTestGame(rawDb, userId, { id: "game-review" });
});

function getNeedsReview(gId: string): number {
  const row = rawDb.prepare("SELECT needs_review FROM games WHERE id = ?").get(gId) as {
    needs_review: number;
  };
  return row.needs_review;
}

describe("ReviewFlags", () => {
  describe("markAsNeedsReview", () => {
    it("should create a flag and set needs_review to 1", async () => {
      await ReviewFlags.markAsNeedsReview(gameId, ReviewReason.LlmCallFailed);

      const flags = rawDb
        .prepare("SELECT * FROM game_review_flags WHERE game_id = ?")
        .all(gameId) as Record<string, unknown>[];

      expect(flags).toHaveLength(1);
      expect(flags[0].reason).toBe("llm_call_failed");
      expect(flags[0].game_id).toBe(gameId);
      expect(getNeedsReview(gameId)).toBe(1);
    });

    it("should store the optional detail field", async () => {
      await ReviewFlags.markAsNeedsReview(
        gameId,
        ReviewReason.LowConfidence,
        "Only 40% confidence",
      );

      const flags = rawDb
        .prepare("SELECT detail FROM game_review_flags WHERE game_id = ?")
        .all(gameId) as Record<string, unknown>[];

      expect(flags[0].detail).toBe("Only 40% confidence");
    });

    it("should set detail to null when not provided", async () => {
      await ReviewFlags.markAsNeedsReview(gameId, ReviewReason.EmptyMetadata);

      const flags = rawDb
        .prepare("SELECT detail FROM game_review_flags WHERE game_id = ?")
        .all(gameId) as Record<string, unknown>[];

      expect(flags[0].detail).toBeNull();
    });

    it("should allow multiple flags on the same game", async () => {
      await ReviewFlags.markAsNeedsReview(gameId, ReviewReason.LlmCallFailed);
      await ReviewFlags.markAsNeedsReview(gameId, ReviewReason.EmptyMetadata, "no tags");

      const flags = rawDb
        .prepare("SELECT * FROM game_review_flags WHERE game_id = ?")
        .all(gameId) as Record<string, unknown>[];

      expect(flags).toHaveLength(2);
      expect(getNeedsReview(gameId)).toBe(1);
    });
  });

  describe("listByGame", () => {
    it("should return flags ordered by created_at", async () => {
      await ReviewFlags.markAsNeedsReview(gameId, ReviewReason.LlmCallFailed);
      await ReviewFlags.markAsNeedsReview(gameId, ReviewReason.LowConfidence, "second flag");

      const flags = await ReviewFlags.listByGame(gameId);

      expect(flags).toHaveLength(2);
      expect(flags[0].reason).toBe(ReviewReason.LlmCallFailed);
      expect(flags[1].reason).toBe(ReviewReason.LowConfidence);
      expect(flags[1].detail).toBe("second flag");
    });

    it("should return an empty array for a game with no flags", async () => {
      const flags = await ReviewFlags.listByGame(gameId);

      expect(flags).toEqual([]);
    });

    it("should return correctly typed ReviewFlag objects", async () => {
      await ReviewFlags.markAsNeedsReview(gameId, ReviewReason.NoTracklistSource);

      const [flag] = await ReviewFlags.listByGame(gameId);

      expect(typeof flag.id).toBe("number");
      expect(flag.gameId).toBe(gameId);
      expect(typeof flag.createdAt).toBe("string");
    });

    it("should not return flags from a different game", async () => {
      const otherGameId = seedTestGame(rawDb, userId, { id: "game-other" });
      await ReviewFlags.markAsNeedsReview(gameId, ReviewReason.LlmCallFailed);
      await ReviewFlags.markAsNeedsReview(otherGameId, ReviewReason.EmptyMetadata);

      const flags = await ReviewFlags.listByGame(gameId);

      expect(flags).toHaveLength(1);
      expect(flags[0].gameId).toBe(gameId);
    });
  });

  describe("dismiss", () => {
    it("should remove the specified flag", async () => {
      await ReviewFlags.markAsNeedsReview(gameId, ReviewReason.LlmCallFailed);
      const [flag] = await ReviewFlags.listByGame(gameId);

      await ReviewFlags.dismiss(flag.id, gameId);

      const remaining = await ReviewFlags.listByGame(gameId);
      expect(remaining).toHaveLength(0);
    });

    it("should clear needs_review when the last flag is dismissed", async () => {
      await ReviewFlags.markAsNeedsReview(gameId, ReviewReason.LlmCallFailed);
      const [flag] = await ReviewFlags.listByGame(gameId);

      await ReviewFlags.dismiss(flag.id, gameId);

      expect(getNeedsReview(gameId)).toBe(0);
    });

    it("should NOT clear needs_review when other flags remain", async () => {
      await ReviewFlags.markAsNeedsReview(gameId, ReviewReason.LlmCallFailed);
      await ReviewFlags.markAsNeedsReview(gameId, ReviewReason.EmptyMetadata);
      const flags = await ReviewFlags.listByGame(gameId);

      await ReviewFlags.dismiss(flags[0].id, gameId);

      expect(getNeedsReview(gameId)).toBe(1);
      expect(await ReviewFlags.listByGame(gameId)).toHaveLength(1);
    });
  });

  describe("clearByGame", () => {
    it("should remove all flags for the game", async () => {
      await ReviewFlags.markAsNeedsReview(gameId, ReviewReason.LlmCallFailed);
      await ReviewFlags.markAsNeedsReview(gameId, ReviewReason.LowConfidence);
      await ReviewFlags.markAsNeedsReview(gameId, ReviewReason.EmptyMetadata);

      await ReviewFlags.clearByGame(gameId);

      expect(await ReviewFlags.listByGame(gameId)).toEqual([]);
    });

    it("should reset needs_review to 0", async () => {
      await ReviewFlags.markAsNeedsReview(gameId, ReviewReason.LlmCallFailed);
      expect(getNeedsReview(gameId)).toBe(1);

      await ReviewFlags.clearByGame(gameId);

      expect(getNeedsReview(gameId)).toBe(0);
    });

    it("should not affect flags on other games", async () => {
      const otherGameId = seedTestGame(rawDb, userId, { id: "game-other-clear" });
      await ReviewFlags.markAsNeedsReview(gameId, ReviewReason.LlmCallFailed);
      await ReviewFlags.markAsNeedsReview(otherGameId, ReviewReason.EmptyMetadata);

      await ReviewFlags.clearByGame(gameId);

      expect(await ReviewFlags.listByGame(otherGameId)).toHaveLength(1);
      expect(getNeedsReview(otherGameId)).toBe(1);
    });
  });
});
