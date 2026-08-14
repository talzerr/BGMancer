import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";
import type { TestRawDB } from "@/lib/db/test-helpers";
import type { DrizzleDB } from "@/lib/db";
import { createTestDrizzleDB, resetTestDB, seedTestUser } from "@/lib/db/test-helpers";
import { TEST_USER_ID } from "@/test/constants";
import { makeGetRequest, parseJson } from "@/test/route-helpers";

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

vi.mock("@/lib/services/auth/auth-helpers", async () => {
  const { TEST_USER_ID } = await import("@/test/constants");
  return {
    getAuthUserId: async () => TEST_USER_ID,
    getAuthSession: async () => ({ authenticated: true, userId: TEST_USER_ID }),
    AuthRequiredError: class extends Error {},
  };
});

const { GET } = await import("../route");

beforeAll(async () => {
  ({ db, rawDb } = await createTestDrizzleDB());
});

beforeEach(async () => {
  await resetTestDB(rawDb);
  await seedTestUser(rawDb);
});

describe("GET /api/steam/library", () => {
  describe("when the user is not linked to Steam", () => {
    it("returns linked: false", async () => {
      const res = await GET(makeGetRequest("/api/steam/library"));
      expect(res.status).toBe(200);

      const body = await parseJson<{ linked: boolean }>(res);
      expect(body).toEqual({ linked: false });
    });
  });

  describe("when the user is linked and has catalog matches", () => {
    beforeEach(async () => {
      await rawDb
        .prepare("UPDATE users SET steam_id = ?, steam_synced_at = ? WHERE id = ?")
        .run("76561198000000000", "2026-04-07T12:00:00.000Z", TEST_USER_ID);

      // Two published games with steam_appids
      await rawDb
        .prepare(
          "INSERT INTO games (id, title, steam_appid, published, onboarding_phase) VALUES (?, ?, ?, true, 'tagged')",
        )
        .run("cat-1", "Catalog Game 1", 111);
      await rawDb
        .prepare(
          "INSERT INTO games (id, title, steam_appid, published, onboarding_phase) VALUES (?, ?, ?, true, 'tagged')",
        )
        .run("cat-2", "Catalog Game 2", 222);

      // User owns both on Steam
      await rawDb
        .prepare(
          "INSERT INTO user_steam_games (user_id, steam_app_id, playtime_minutes) VALUES (?, ?, ?)",
        )
        .run(TEST_USER_ID, 111, 500);
      await rawDb
        .prepare(
          "INSERT INTO user_steam_games (user_id, steam_app_id, playtime_minutes) VALUES (?, ?, ?)",
        )
        .run(TEST_USER_ID, 222, 300);
    });

    it("returns linked: true with matched game IDs", async () => {
      const res = await GET(makeGetRequest("/api/steam/library"));
      expect(res.status).toBe(200);

      const body = await parseJson<{
        linked: boolean;
        steamSyncedAt: string;
        matchedGameIds: string[];
      }>(res);
      expect(body.linked).toBe(true);
      expect(body.steamSyncedAt).toBe("2026-04-07T12:00:00.000Z");
      expect(body.matchedGameIds.sort()).toEqual(["cat-1", "cat-2"]);
    });
  });

  describe("when the user is linked but has no catalog matches", () => {
    beforeEach(async () => {
      await rawDb
        .prepare("UPDATE users SET steam_id = ?, steam_synced_at = ? WHERE id = ?")
        .run("76561198000000000", "2026-04-07T12:00:00.000Z", TEST_USER_ID);

      // User owns a Steam game that has no catalog entry
      await rawDb
        .prepare(
          "INSERT INTO user_steam_games (user_id, steam_app_id, playtime_minutes) VALUES (?, ?, ?)",
        )
        .run(TEST_USER_ID, 99999, 10);
    });

    it("returns linked: true with empty matchedGameIds", async () => {
      const res = await GET(makeGetRequest("/api/steam/library"));
      expect(res.status).toBe(200);

      const body = await parseJson<{
        linked: boolean;
        matchedGameIds: string[];
      }>(res);
      expect(body.linked).toBe(true);
      expect(body.matchedGameIds).toEqual([]);
    });
  });
});
