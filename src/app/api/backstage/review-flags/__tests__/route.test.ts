import { describe, it, expect, vi, beforeEach } from "vitest";
import type Database from "better-sqlite3";
import type { DrizzleDB } from "@/lib/db";
import { createTestDrizzleDB, seedTestUser, seedTestGame } from "@/lib/db/test-helpers";
import { TEST_USER_ID, TEST_GAME_ID, TEST_GAME_TITLE } from "@/test/constants";
import { makeJsonRequest, parseJson } from "@/test/route-helpers";

let db: DrizzleDB;
let rawDb: Database.Database;

vi.mock("@/lib/db", async () => {
  const { MOCK_LOCAL_USER_ID, MOCK_LOCAL_LIBRARY_ID } = await import("@/test/constants");
  return {
    getDB: () => db,

    LOCAL_USER_ID: MOCK_LOCAL_USER_ID,
    LOCAL_LIBRARY_ID: MOCK_LOCAL_LIBRARY_ID,
  };
});

const { DELETE: DELETE_HANDLER } = await import("../route");

beforeEach(() => {
  ({ db, rawDb } = createTestDrizzleDB());
  seedTestUser(rawDb);
});

/** Insert a review flag directly. Returns the flag's rowid. */
function seedReviewFlag(db: Database.Database, gameId: string, reason: string): number {
  const info = rawDb
    .prepare("INSERT INTO game_review_flags (game_id, reason) VALUES (?, ?)")
    .run(gameId, reason);
  rawDb.prepare("UPDATE games SET needs_review = 1 WHERE id = ?").run(gameId);
  return Number(info.lastInsertRowid);
}

describe("DELETE /api/backstage/review-flags", () => {
  describe("when clearing all flags for a game", () => {
    it("should return success", async () => {
      seedTestGame(rawDb, TEST_USER_ID, { id: TEST_GAME_ID, title: TEST_GAME_TITLE });
      seedReviewFlag(rawDb, TEST_GAME_ID, "no_tracks");
      seedReviewFlag(rawDb, TEST_GAME_ID, "bad_playlist");

      const res = await DELETE_HANDLER(
        makeJsonRequest("/api/backstage/review-flags", "DELETE", { gameId: TEST_GAME_ID }),
      );

      expect(res.status).toBe(200);

      const body = await parseJson<{ ok: boolean }>(res);
      expect(body.ok).toBe(true);

      // All flags should be cleared
      const remaining = rawDb
        .prepare("SELECT COUNT(*) AS cnt FROM game_review_flags WHERE game_id = ?")
        .get(TEST_GAME_ID) as { cnt: number };
      expect(remaining.cnt).toBe(0);

      // needs_review should be reset
      const game = rawDb
        .prepare("SELECT needs_review FROM games WHERE id = ?")
        .get(TEST_GAME_ID) as {
        needs_review: number;
      };
      expect(game.needs_review).toBe(0);
    });
  });

  describe("when dismissing a single flag", () => {
    it("should return success", async () => {
      seedTestGame(rawDb, TEST_USER_ID, { id: TEST_GAME_ID, title: TEST_GAME_TITLE });
      const flagId1 = seedReviewFlag(rawDb, TEST_GAME_ID, "no_tracks");
      seedReviewFlag(rawDb, TEST_GAME_ID, "bad_playlist");

      const res = await DELETE_HANDLER(
        makeJsonRequest("/api/backstage/review-flags", "DELETE", {
          gameId: TEST_GAME_ID,
          flagId: flagId1,
        }),
      );

      expect(res.status).toBe(200);

      const body = await parseJson<{ ok: boolean }>(res);
      expect(body.ok).toBe(true);
    });

    it("should NOT remove other flags", async () => {
      seedTestGame(rawDb, TEST_USER_ID, { id: TEST_GAME_ID, title: TEST_GAME_TITLE });
      const flagId1 = seedReviewFlag(rawDb, TEST_GAME_ID, "no_tracks");
      const flagId2 = seedReviewFlag(rawDb, TEST_GAME_ID, "bad_playlist");

      await DELETE_HANDLER(
        makeJsonRequest("/api/backstage/review-flags", "DELETE", {
          gameId: TEST_GAME_ID,
          flagId: flagId1,
        }),
      );

      // The dismissed flag should be gone
      const dismissed = rawDb.prepare("SELECT id FROM game_review_flags WHERE id = ?").get(flagId1);
      expect(dismissed).toBeUndefined();

      // The other flag should remain
      const remaining = rawDb
        .prepare("SELECT id FROM game_review_flags WHERE id = ?")
        .get(flagId2) as { id: number } | undefined;
      expect(remaining).toBeDefined();
      expect(remaining!.id).toBe(flagId2);
    });
  });

  describe("when gameId is missing", () => {
    it("should return 400", async () => {
      const res = await DELETE_HANDLER(
        makeJsonRequest("/api/backstage/review-flags", "DELETE", {}),
      );

      expect(res.status).toBe(400);

      const body = await parseJson<{ error: string }>(res);
      expect(body.error).toMatch(/gameId/i);
    });
  });
});
