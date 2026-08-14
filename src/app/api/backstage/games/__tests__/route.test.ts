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
import { makeGetRequest, makeJsonRequest, parseJson } from "@/test/route-helpers";

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

const { GET, POST } = await import("../route");

beforeAll(async () => {
  ({ db, rawDb } = await createTestDrizzleDB());
});

beforeEach(async () => {
  await resetTestDB(rawDb);
  await seedTestUser(rawDb);
});

describe("GET /api/backstage/games", () => {
  describe("when games exist", () => {
    it("should return games with stats", async () => {
      await seedTestGame(rawDb, TEST_USER_ID, { id: TEST_GAME_ID, title: TEST_GAME_TITLE });
      await seedTestGame(rawDb, TEST_USER_ID, { id: "g2", title: "Hollow Knight" });

      const res = await GET(makeGetRequest("/api/backstage/games"));
      expect(res.status).toBe(200);

      const games = await parseJson<Array<{ id: string; title: string; trackCount: number }>>(res);
      expect(games).toHaveLength(2);

      const ids = games.map((g) => g.id);
      expect(ids).toContain(TEST_GAME_ID);
      expect(ids).toContain("g2");
      // Stats fields should be present
      expect(games[0]).toHaveProperty("trackCount");
      expect(games[0]).toHaveProperty("taggedCount");
      expect(games[0]).toHaveProperty("activeCount");
    });
  });

  describe("when filtering by title", () => {
    it("should filter results", async () => {
      await seedTestGame(rawDb, TEST_USER_ID, { id: TEST_GAME_ID, title: TEST_GAME_TITLE });
      await seedTestGame(rawDb, TEST_USER_ID, { id: "g2", title: "Hollow Knight" });

      const res = await GET(makeGetRequest("/api/backstage/games", { title: "Hollow" }));
      expect(res.status).toBe(200);

      const games = await parseJson<Array<{ id: string; title: string }>>(res);
      expect(games).toHaveLength(1);
      expect(games[0].title).toBe("Hollow Knight");
    });
  });

  describe("when filtering by published", () => {
    it("should only return published games", async () => {
      await seedTestGame(rawDb, TEST_USER_ID, {
        id: "pub",
        title: "Published Game",
        published: true,
      });
      await seedTestGame(rawDb, TEST_USER_ID, {
        id: "draft",
        title: "Draft Game",
        published: false,
      });

      const res = await GET(makeGetRequest("/api/backstage/games", { published: "1" }));
      expect(res.status).toBe(200);

      const games = await parseJson<Array<{ id: string; published: boolean }>>(res);
      expect(games).toHaveLength(1);
      expect(games[0].id).toBe("pub");
      expect(games[0].published).toBe(true);
    });
  });
});

describe("POST /api/backstage/games", () => {
  describe("when creating a draft game", () => {
    it("should return 201 with the game", async () => {
      const res = await POST(
        makeJsonRequest("/api/backstage/games", "POST", { title: "New Draft Game" }),
      );
      expect(res.status).toBe(201);

      const game = await parseJson<{ id: string; title: string; published: boolean }>(res);
      expect(game.title).toBe("New Draft Game");
      expect(game.published).toBe(false);
      expect(game.id).toBeDefined();
    });
  });

  describe("when title is missing", () => {
    it("should return 400", async () => {
      const res = await POST(makeJsonRequest("/api/backstage/games", "POST", {}));
      expect(res.status).toBe(400);

      const body = await parseJson<{ error: string }>(res);
      expect(body.error).toMatch(/title/i);
    });
  });

  describe("when title is empty string", () => {
    it("should return 400", async () => {
      const res = await POST(makeJsonRequest("/api/backstage/games", "POST", { title: "   " }));
      expect(res.status).toBe(400);

      const body = await parseJson<{ error: string }>(res);
      expect(body.error).toMatch(/title/i);
    });
  });
});
