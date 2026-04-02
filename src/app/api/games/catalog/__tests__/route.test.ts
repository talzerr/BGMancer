import { describe, it, expect, vi, beforeEach } from "vitest";
import type Database from "better-sqlite3";
import type { DrizzleDB } from "@/lib/db";
import { createTestDrizzleDB, seedTestUser, seedTestGame } from "@/lib/db/test-helpers";
import { TEST_USER_ID } from "@/test/constants";
import { makeGetRequest, parseJson } from "@/test/route-helpers";

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

const { GET } = await import("../route");

beforeEach(() => {
  ({ db, rawDb } = createTestDrizzleDB());
  seedTestUser(rawDb);
});

describe("GET /api/games/catalog", () => {
  describe("when published games exist", () => {
    it("should return them", async () => {
      seedTestGame(rawDb, TEST_USER_ID, { id: "pub-a", title: "Alpha Game", published: true });
      seedTestGame(rawDb, TEST_USER_ID, { id: "pub-b", title: "Beta Game", published: true });

      const res = await GET(makeGetRequest("/api/games/catalog"));
      expect(res.status).toBe(200);

      const games = await parseJson<Array<{ id: string; title: string }>>(res);
      expect(games.length).toBeGreaterThanOrEqual(2);
      const ids = games.map((g) => g.id);
      expect(ids).toContain("pub-a");
      expect(ids).toContain("pub-b");
    });
  });

  describe("when search query is provided", () => {
    it("should filter by title", async () => {
      seedTestGame(rawDb, TEST_USER_ID, { id: "pub-a", title: "Alpha Game", published: true });
      seedTestGame(rawDb, TEST_USER_ID, { id: "pub-b", title: "Beta Game", published: true });

      const res = await GET(makeGetRequest("/api/games/catalog", { q: "Alpha" }));
      expect(res.status).toBe(200);

      const games = await parseJson<Array<{ id: string; title: string }>>(res);
      expect(games).toHaveLength(1);
      expect(games[0].title).toBe("Alpha Game");
    });
  });

  describe("when no games match", () => {
    it("should return empty array", async () => {
      seedTestGame(rawDb, TEST_USER_ID, { id: "pub-a", title: "Alpha Game", published: true });

      const res = await GET(makeGetRequest("/api/games/catalog", { q: "Nonexistent" }));
      expect(res.status).toBe(200);

      const games = await parseJson<unknown[]>(res);
      expect(games).toHaveLength(0);
    });
  });

  describe("when unpublished games exist", () => {
    it("should NOT return them", async () => {
      seedTestGame(rawDb, TEST_USER_ID, { id: "pub-a", title: "Published Game", published: true });
      seedTestGame(rawDb, TEST_USER_ID, {
        id: "draft-b",
        title: "Draft Game",
        published: false,
      });

      const res = await GET(makeGetRequest("/api/games/catalog"));
      expect(res.status).toBe(200);

      const games = await parseJson<Array<{ id: string }>>(res);
      const ids = games.map((g) => g.id);
      expect(ids).toContain("pub-a");
      expect(ids).not.toContain("draft-b");
    });
  });
});
