import { describe, it, expect, vi, beforeEach } from "vitest";
import type Database from "better-sqlite3";
import type { DrizzleDB } from "@/lib/db";
import { createTestDrizzleDB, seedTestUser } from "@/lib/db/test-helpers";
import { TEST_USER_ID } from "@/test/constants";
import { makeJsonRequest, parseJson } from "@/test/route-helpers";

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

const { DELETE } = await import("../route");

beforeEach(() => {
  ({ db, rawDb } = createTestDrizzleDB());
  seedTestUser(rawDb);
});

describe("DELETE /api/steam/link", () => {
  describe("when the user is linked with synced games", () => {
    beforeEach(() => {
      rawDb
        .prepare("UPDATE users SET steam_id = ?, steam_synced_at = ? WHERE id = ?")
        .run("76561198000000000", "2026-04-07T12:00:00.000Z", TEST_USER_ID);

      for (const appid of [111, 222, 333]) {
        rawDb
          .prepare(
            "INSERT INTO user_steam_games (user_id, steam_app_id, playtime_minutes) VALUES (?, ?, ?)",
          )
          .run(TEST_USER_ID, appid, 100);
      }
    });

    it("returns 200 with success", async () => {
      const res = await DELETE(makeJsonRequest("/api/steam/link", "DELETE"));
      expect(res.status).toBe(200);

      const body = await parseJson<{ success: boolean }>(res);
      expect(body.success).toBe(true);
    });

    it("nulls out steam_id and steam_synced_at on the user row", async () => {
      await DELETE(makeJsonRequest("/api/steam/link", "DELETE"));

      const row = rawDb
        .prepare("SELECT steam_id, steam_synced_at FROM users WHERE id = ?")
        .get(TEST_USER_ID) as { steam_id: string | null; steam_synced_at: string | null };
      expect(row.steam_id).toBeNull();
      expect(row.steam_synced_at).toBeNull();
    });

    it("deletes all user_steam_games rows for the user", async () => {
      await DELETE(makeJsonRequest("/api/steam/link", "DELETE"));

      const rows = rawDb
        .prepare("SELECT * FROM user_steam_games WHERE user_id = ?")
        .all(TEST_USER_ID);
      expect(rows).toHaveLength(0);
    });
  });
});
