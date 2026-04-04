import { describe, it, expect, vi, beforeEach } from "vitest";
import type Database from "better-sqlite3";
import type { DrizzleDB } from "@/lib/db";
import { createTestDrizzleDB, seedTestUser, seedTestGame } from "../../test-helpers";
import { TEST_USER_ID, TEST_GAME_ID } from "@/test/constants";

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

const { Favorites } = await import("../favorites");

beforeEach(() => {
  ({ db, rawDb } = createTestDrizzleDB());
  seedTestUser(rawDb);
  seedTestGame(rawDb, TEST_USER_ID, { id: TEST_GAME_ID });
});

describe("Favorites", () => {
  describe("listByUser", () => {
    it("should return empty array when no favorites", async () => {
      expect(await Favorites.listByUser(TEST_USER_ID)).toEqual([]);
    });

    it("should return favorited game IDs", async () => {
      await Favorites.toggle(TEST_USER_ID, TEST_GAME_ID);
      expect(await Favorites.listByUser(TEST_USER_ID)).toEqual([TEST_GAME_ID]);
    });
  });

  describe("toggle", () => {
    it("should add a favorite and return true", async () => {
      const result = await Favorites.toggle(TEST_USER_ID, TEST_GAME_ID);
      expect(result).toBe(true);
      expect(await Favorites.listByUser(TEST_USER_ID)).toEqual([TEST_GAME_ID]);
    });

    it("should remove a favorite and return false on second toggle", async () => {
      await Favorites.toggle(TEST_USER_ID, TEST_GAME_ID);
      const result = await Favorites.toggle(TEST_USER_ID, TEST_GAME_ID);
      expect(result).toBe(false);
      expect(await Favorites.listByUser(TEST_USER_ID)).toEqual([]);
    });
  });
});
