import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";
import type { TestRawDB } from "@/lib/db/test-helpers";
import type { DrizzleDB } from "@/lib/db";
import {
  createTestDrizzleDB,
  resetTestDB,
  seedTestUser,
  seedTestGame,
} from "@/lib/db/test-helpers";
import { TEST_USER_ID, TEST_GAME_ID, TEST_GAME_TITLE } from "@/test/constants";
import { makeJsonRequest, parseJson } from "@/test/route-helpers";

let db: DrizzleDB;
let rawDb: TestRawDB;

vi.mock("@/lib/db", async () => {
  const { MOCK_LOCAL_USER_ID, MOCK_LOCAL_LIBRARY_ID } = await import("@/test/constants");
  const { createDbMock } = await import("@/test/db-mock");
  return {
    ...createDbMock(() => db),
    LOCAL_USER_ID: MOCK_LOCAL_USER_ID,
    LOCAL_LIBRARY_ID: MOCK_LOCAL_LIBRARY_ID,
  };
});

const { DELETE: DELETE_HANDLER } = await import("../route");

beforeAll(async () => {
  ({ db, rawDb } = await createTestDrizzleDB());
});

beforeEach(async () => {
  await resetTestDB(rawDb);
  await seedTestUser(rawDb);
});

/** Insert a review flag directly. Returns the flag's id. */
async function seedReviewFlag(gameId: string, reason: string): Promise<number> {
  const row = await rawDb
    .prepare("INSERT INTO game_review_flags (game_id, reason) VALUES (?, ?) RETURNING id")
    .get<{ id: number }>(gameId, reason);
  await rawDb.prepare("UPDATE games SET needs_review = true WHERE id = ?").run(gameId);
  return Number(row!.id);
}

describe("DELETE /api/backstage/review-flags", () => {
  describe("when clearing all flags for a game", () => {
    it("should return success", async () => {
      await seedTestGame(rawDb, TEST_USER_ID, { id: TEST_GAME_ID, title: TEST_GAME_TITLE });
      await seedReviewFlag(TEST_GAME_ID, "no_tracks");
      await seedReviewFlag(TEST_GAME_ID, "bad_playlist");

      const res = await DELETE_HANDLER(
        makeJsonRequest("/api/backstage/review-flags", "DELETE", { gameId: TEST_GAME_ID }),
      );

      expect(res.status).toBe(200);

      const body = await parseJson<{ ok: boolean }>(res);
      expect(body.ok).toBe(true);

      // All flags should be cleared
      const remaining = (await rawDb
        .prepare("SELECT COUNT(*) AS cnt FROM game_review_flags WHERE game_id = ?")
        .get(TEST_GAME_ID)) as { cnt: number };
      expect(remaining.cnt).toBe(0);

      // needs_review should be reset
      const game = (await rawDb
        .prepare("SELECT needs_review FROM games WHERE id = ?")
        .get(TEST_GAME_ID)) as {
        needs_review: boolean;
      };
      expect(game.needs_review).toBe(false);
    });
  });

  describe("when dismissing a single flag", () => {
    it("should return success", async () => {
      await seedTestGame(rawDb, TEST_USER_ID, { id: TEST_GAME_ID, title: TEST_GAME_TITLE });
      const flagId1 = await seedReviewFlag(TEST_GAME_ID, "no_tracks");
      await seedReviewFlag(TEST_GAME_ID, "bad_playlist");

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
      await seedTestGame(rawDb, TEST_USER_ID, { id: TEST_GAME_ID, title: TEST_GAME_TITLE });
      const flagId1 = await seedReviewFlag(TEST_GAME_ID, "no_tracks");
      const flagId2 = await seedReviewFlag(TEST_GAME_ID, "bad_playlist");

      await DELETE_HANDLER(
        makeJsonRequest("/api/backstage/review-flags", "DELETE", {
          gameId: TEST_GAME_ID,
          flagId: flagId1,
        }),
      );

      // The dismissed flag should be gone
      const dismissed = await rawDb
        .prepare("SELECT id FROM game_review_flags WHERE id = ?")
        .get(flagId1);
      expect(dismissed).toBeUndefined();

      // The other flag should remain
      const remaining = (await rawDb
        .prepare("SELECT id FROM game_review_flags WHERE id = ?")
        .get(flagId2)) as { id: number } | undefined;
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
