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
    batch: async (queries: any[]) => db.batch(queries),

    LOCAL_USER_ID: MOCK_LOCAL_USER_ID,
    LOCAL_LIBRARY_ID: MOCK_LOCAL_LIBRARY_ID,
  };
});

const { PATCH, DELETE: DELETE_HANDLER } = await import("../route");

beforeEach(() => {
  ({ db, rawDb } = createTestDrizzleDB());
  seedTestUser(rawDb);
});

describe("PATCH /api/backstage/games/[gameId]", () => {
  describe("when updating title", () => {
    it("should return updated game", async () => {
      seedTestGame(rawDb, TEST_USER_ID, { id: TEST_GAME_ID, title: TEST_GAME_TITLE });

      const res = await PATCH(
        makeJsonRequest(`/api/backstage/games/${TEST_GAME_ID}`, "PATCH", {
          title: "Dark Souls Remastered",
        }),
        { params: Promise.resolve({ gameId: TEST_GAME_ID }) },
      );

      expect(res.status).toBe(200);

      const game = await parseJson<{ id: string; title: string }>(res);
      expect(game.id).toBe(TEST_GAME_ID);
      expect(game.title).toBe("Dark Souls Remastered");
    });
  });

  describe("when game doesn't exist", () => {
    it("should return 404", async () => {
      const res = await PATCH(
        makeJsonRequest("/api/backstage/games/nonexistent", "PATCH", { title: "Nope" }),
        { params: Promise.resolve({ gameId: "nonexistent" }) },
      );

      expect(res.status).toBe(404);

      const body = await parseJson<{ error: string }>(res);
      expect(body.error).toMatch(/not found/i);
    });
  });

  describe("when no fields provided", () => {
    it("should return 400", async () => {
      seedTestGame(rawDb, TEST_USER_ID, { id: TEST_GAME_ID, title: TEST_GAME_TITLE });

      const res = await PATCH(
        makeJsonRequest(`/api/backstage/games/${TEST_GAME_ID}`, "PATCH", {}),
        { params: Promise.resolve({ gameId: TEST_GAME_ID }) },
      );

      expect(res.status).toBe(400);

      const body = await parseJson<{ error: string }>(res);
      expect(body.error).toMatch(/no fields/i);
    });
  });
});

describe("DELETE /api/backstage/games/[gameId]", () => {
  describe("when deleting an unpublished game", () => {
    it("should return success", async () => {
      seedTestGame(rawDb, TEST_USER_ID, {
        id: TEST_GAME_ID,
        title: TEST_GAME_TITLE,
        published: false,
      });

      const res = await DELETE_HANDLER(
        makeJsonRequest(`/api/backstage/games/${TEST_GAME_ID}`, "DELETE"),
        { params: Promise.resolve({ gameId: TEST_GAME_ID }) },
      );

      expect(res.status).toBe(200);

      const body = await parseJson<{ ok: boolean }>(res);
      expect(body.ok).toBe(true);

      // Verify game is removed from DB
      const row = rawDb.prepare("SELECT id FROM games WHERE id = ?").get(TEST_GAME_ID);
      expect(row).toBeUndefined();
    });
  });

  describe("when game is published", () => {
    it("should return 400", async () => {
      seedTestGame(rawDb, TEST_USER_ID, {
        id: TEST_GAME_ID,
        title: TEST_GAME_TITLE,
        published: true,
      });

      const res = await DELETE_HANDLER(
        makeJsonRequest(`/api/backstage/games/${TEST_GAME_ID}`, "DELETE"),
        { params: Promise.resolve({ gameId: TEST_GAME_ID }) },
      );

      expect(res.status).toBe(400);

      const body = await parseJson<{ error: string }>(res);
      expect(body.error).toMatch(/published/i);
    });
  });

  describe("when game doesn't exist", () => {
    it("should return 404", async () => {
      const res = await DELETE_HANDLER(
        makeJsonRequest("/api/backstage/games/nonexistent", "DELETE"),
        { params: Promise.resolve({ gameId: "nonexistent" }) },
      );

      expect(res.status).toBe(404);

      const body = await parseJson<{ error: string }>(res);
      expect(body.error).toMatch(/not found/i);
    });
  });
});
