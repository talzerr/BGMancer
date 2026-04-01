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

const { POST } = await import("../route");

beforeEach(() => {
  ({ db, rawDb } = createTestDrizzleDB());
  seedTestUser(rawDb);
});

describe("POST /api/backstage/publish", () => {
  describe("when publishing a game", () => {
    it("should set published=true", async () => {
      seedTestGame(rawDb, TEST_USER_ID, {
        id: TEST_GAME_ID,
        title: TEST_GAME_TITLE,
        published: false,
      });

      const res = await POST(
        makeJsonRequest("/api/backstage/publish", "POST", {
          gameId: TEST_GAME_ID,
          published: true,
        }),
      );

      expect(res.status).toBe(200);

      const body = await parseJson<{ ok: boolean; published: boolean }>(res);
      expect(body.ok).toBe(true);
      expect(body.published).toBe(true);

      // Verify in DB
      const row = rawDb.prepare("SELECT published FROM games WHERE id = ?").get(TEST_GAME_ID) as {
        published: number;
      };
      expect(row.published).toBe(1);
    });
  });

  describe("when unpublishing a game", () => {
    it("should set published=false", async () => {
      seedTestGame(rawDb, TEST_USER_ID, {
        id: TEST_GAME_ID,
        title: TEST_GAME_TITLE,
        published: true,
      });

      const res = await POST(
        makeJsonRequest("/api/backstage/publish", "POST", {
          gameId: TEST_GAME_ID,
          published: false,
        }),
      );

      expect(res.status).toBe(200);

      const body = await parseJson<{ ok: boolean; published: boolean }>(res);
      expect(body.ok).toBe(true);
      expect(body.published).toBe(false);

      // Verify in DB
      const row = rawDb.prepare("SELECT published FROM games WHERE id = ?").get(TEST_GAME_ID) as {
        published: number;
      };
      expect(row.published).toBe(0);
    });
  });

  describe("when game doesn't exist", () => {
    it("should return 404", async () => {
      const res = await POST(
        makeJsonRequest("/api/backstage/publish", "POST", {
          gameId: "nonexistent",
          published: true,
        }),
      );

      expect(res.status).toBe(404);

      const body = await parseJson<{ error: string }>(res);
      expect(body.error).toMatch(/not found/i);
    });
  });

  describe("when gameId is missing", () => {
    it("should return 400", async () => {
      const res = await POST(
        makeJsonRequest("/api/backstage/publish", "POST", { published: true }),
      );

      expect(res.status).toBe(400);

      const body = await parseJson<{ error: string }>(res);
      expect(body.error).toMatch(/gameId/i);
    });
  });

  describe("when published is not a boolean", () => {
    it("should return 400", async () => {
      const res = await POST(
        makeJsonRequest("/api/backstage/publish", "POST", {
          gameId: TEST_GAME_ID,
          published: "yes",
        }),
      );

      expect(res.status).toBe(400);

      const body = await parseJson<{ error: string }>(res);
      expect(body.error).toMatch(/published/i);
    });
  });
});
