import { describe, it, expect, vi, beforeEach } from "vitest";
import type Database from "better-sqlite3";
import type { DrizzleDB } from "@/lib/db";
import { createTestDrizzleDB, seedTestUser, seedTestGame } from "@/lib/db/test-helpers";
import { TEST_USER_ID, TEST_GAME_ID, TEST_GAME_TITLE } from "@/test/constants";
import { makeGetRequest, makeJsonRequest, parseJson } from "@/test/route-helpers";

let db: DrizzleDB;
let rawDb: Database.Database;

vi.mock("@/lib/db", async () => {
  const { MOCK_LOCAL_USER_ID, MOCK_LOCAL_LIBRARY_ID } = await import("@/test/constants");
  return {
    getDB: () => db,
    batch: async (queries: any[]) => db.batch(queries as [any]),

    LOCAL_USER_ID: MOCK_LOCAL_USER_ID,
    LOCAL_LIBRARY_ID: MOCK_LOCAL_LIBRARY_ID,
  };
});

vi.mock("@/lib/services/auth/auth-helpers", async () => {
  const { TEST_USER_ID } = await import("@/test/constants");
  return {
    getAuthUserId: async () => TEST_USER_ID,
    getAuthSession: async () => ({ authenticated: true, userId: TEST_USER_ID }),
    AuthRequiredError: class extends Error {},
  };
});

const { GET, POST, PATCH, DELETE: DELETE_HANDLER } = await import("../route");

beforeEach(() => {
  ({ db, rawDb } = createTestDrizzleDB());
  seedTestUser(rawDb);
});

describe("GET /api/games", () => {
  describe("when user has games in library", () => {
    it("should return the games", async () => {
      seedTestGame(rawDb, TEST_USER_ID, { id: TEST_GAME_ID, title: TEST_GAME_TITLE });
      seedTestGame(rawDb, TEST_USER_ID, { id: "g2", title: "Hollow Knight" });

      const res = await GET(makeGetRequest("/api/games"));
      expect(res.status).toBe(200);

      const games = await parseJson<Array<{ id: string; title: string }>>(res);
      expect(games).toHaveLength(2);
      expect(games.map((g) => g.id)).toContain(TEST_GAME_ID);
      expect(games.map((g) => g.id)).toContain("g2");
    });
  });

  describe("when user has no games", () => {
    it("should return empty array", async () => {
      const res = await GET(makeGetRequest("/api/games"));
      expect(res.status).toBe(200);

      const games = await parseJson<unknown[]>(res);
      expect(games).toHaveLength(0);
    });
  });

  describe("when YT_IMPORT_GAME_ID game exists", () => {
    it("should NOT include it", async () => {
      seedTestGame(rawDb, TEST_USER_ID, { id: "yt-import", title: "YT Import" });
      seedTestGame(rawDb, TEST_USER_ID, { id: "real-game", title: "Real Game" });

      const res = await GET(makeGetRequest("/api/games"));
      expect(res.status).toBe(200);

      const games = await parseJson<Array<{ id: string }>>(res);
      const ids = games.map((g) => g.id);
      expect(ids).not.toContain("yt-import");
      expect(ids).toContain("real-game");
    });
  });
});

describe("POST /api/games", () => {
  describe("when posting with valid gameId of a published game", () => {
    it("should return 201 with the linked game", async () => {
      // Insert a published game directly (not linked to library)
      rawDb
        .prepare(
          "INSERT INTO games (id, title, published, onboarding_phase) VALUES (?, ?, 1, 'tagged')",
        )
        .run("pub-game", "Published Game");

      const res = await POST(makeJsonRequest("/api/games", "POST", { gameId: "pub-game" }));
      expect(res.status).toBe(201);

      const game = await parseJson<{ id: string; title: string }>(res);
      expect(game.id).toBe("pub-game");
      expect(game.title).toBe("Published Game");
    });
  });

  describe("when gameId is missing", () => {
    it("should return 400", async () => {
      const res = await POST(makeJsonRequest("/api/games", "POST", {}));
      expect(res.status).toBe(400);

      const body = await parseJson<{ error: string }>(res);
      expect(body.error).toMatch(/gameId/i);
    });
  });

  describe("when game is not published", () => {
    it("should return 404", async () => {
      rawDb
        .prepare(
          "INSERT INTO games (id, title, published, onboarding_phase) VALUES (?, ?, 0, 'draft')",
        )
        .run("draft-game", "Draft Game");

      const res = await POST(makeJsonRequest("/api/games", "POST", { gameId: "draft-game" }));
      expect(res.status).toBe(404);
    });
  });

  describe("when library is at max", () => {
    it("should return 400", async () => {
      // Seed 500 games to hit the limit
      for (let i = 0; i < 500; i++) {
        seedTestGame(rawDb, TEST_USER_ID, { id: `fill-${i}`, title: `Fill Game ${i}` });
      }

      // Insert a new published game to try to add
      rawDb
        .prepare(
          "INSERT INTO games (id, title, published, onboarding_phase) VALUES (?, ?, 1, 'tagged')",
        )
        .run("one-too-many", "One Too Many");

      const res = await POST(makeJsonRequest("/api/games", "POST", { gameId: "one-too-many" }));
      expect(res.status).toBe(400);

      const body = await parseJson<{ error: string }>(res);
      expect(body.error).toMatch(/limit/i);
    });
  });
});

describe("PATCH /api/games", () => {
  describe("when updating curation", () => {
    it("should return updated game", async () => {
      seedTestGame(rawDb, TEST_USER_ID, { id: TEST_GAME_ID, title: TEST_GAME_TITLE });

      const res = await PATCH(
        makeJsonRequest(`/api/games?id=${TEST_GAME_ID}`, "PATCH", { curation: "focus" }),
      );
      expect(res.status).toBe(200);

      const game = await parseJson<{ id: string; curation: string }>(res);
      expect(game.id).toBe(TEST_GAME_ID);
      expect(game.curation).toBe("focus");
    });
  });

  describe("when game ID is missing", () => {
    it("should return 400", async () => {
      const res = await PATCH(makeJsonRequest("/api/games", "PATCH", { curation: "focus" }));
      expect(res.status).toBe(400);

      const body = await parseJson<{ error: string }>(res);
      expect(body.error).toMatch(/game id/i);
    });
  });
});

describe("DELETE /api/games", () => {
  describe("when deleting a game", () => {
    it("should return success", async () => {
      seedTestGame(rawDb, TEST_USER_ID, { id: TEST_GAME_ID, title: TEST_GAME_TITLE });

      const res = await DELETE_HANDLER(makeJsonRequest(`/api/games?id=${TEST_GAME_ID}`, "DELETE"));
      expect(res.status).toBe(200);

      const body = await parseJson<{ success: boolean }>(res);
      expect(body.success).toBe(true);
    });

    it("should still have game record in games table (only library link removed)", async () => {
      seedTestGame(rawDb, TEST_USER_ID, { id: TEST_GAME_ID, title: TEST_GAME_TITLE });

      await DELETE_HANDLER(makeJsonRequest(`/api/games?id=${TEST_GAME_ID}`, "DELETE"));

      // Game record still exists
      const row = rawDb.prepare("SELECT id FROM games WHERE id = ?").get(TEST_GAME_ID) as
        | { id: string }
        | undefined;
      expect(row).toBeDefined();
      expect(row!.id).toBe(TEST_GAME_ID);

      // Library link is gone
      const link = rawDb
        .prepare("SELECT * FROM library_games WHERE game_id = ?")
        .get(TEST_GAME_ID) as unknown | undefined;
      expect(link).toBeUndefined();
    });
  });

  describe("when game ID is missing", () => {
    it("should return 400", async () => {
      const res = await DELETE_HANDLER(makeJsonRequest("/api/games", "DELETE"));
      expect(res.status).toBe(400);

      const body = await parseJson<{ error: string }>(res);
      expect(body.error).toMatch(/game id/i);
    });
  });
});
