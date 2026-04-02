import { describe, it, expect, vi, beforeEach } from "vitest";
import type Database from "better-sqlite3";
import type { DrizzleDB } from "@/lib/db";
import {
  createTestDrizzleDB,
  seedTestUser,
  seedTestGame,
  seedTestSession,
} from "@/lib/db/test-helpers";
import { TEST_USER_ID, TEST_GAME_ID, TEST_GAME_TITLE } from "@/test/constants";
import { parseJson } from "@/test/route-helpers";

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

vi.mock("@/lib/services/auth-helpers", async () => {
  const { TEST_USER_ID } = await import("@/test/constants");
  return {
    getAuthUserId: async () => TEST_USER_ID,
    getAuthSession: async () => ({ authenticated: true, userId: TEST_USER_ID }),
    AuthRequiredError: class extends Error {},
  };
});

const { GET } = await import("../route");

beforeEach(() => {
  ({ db, rawDb } = createTestDrizzleDB());
  seedTestUser(rawDb);
});

describe("GET /api/sessions", () => {
  describe("when user has sessions", () => {
    it("should return sessions with track counts", async () => {
      seedTestGame(rawDb, TEST_USER_ID, { id: TEST_GAME_ID, title: TEST_GAME_TITLE });
      const sessionId = seedTestSession(rawDb, TEST_USER_ID, { id: "s1", name: "Session One" });

      // Add some tracks to the session
      rawDb
        .prepare(
          `INSERT INTO playlist_tracks (id, playlist_id, game_id, track_name, position)
         VALUES (?, ?, ?, ?, ?)`,
        )
        .run("pt1", sessionId, TEST_GAME_ID, "Track 1", 0);
      rawDb
        .prepare(
          `INSERT INTO playlist_tracks (id, playlist_id, game_id, track_name, position)
         VALUES (?, ?, ?, ?, ?)`,
        )
        .run("pt2", sessionId, TEST_GAME_ID, "Track 2", 1);

      const res = await GET(new Request("http://localhost:6959/api/sessions"));
      expect(res.status).toBe(200);

      const sessions =
        await parseJson<Array<{ id: string; name: string; track_count: number }>>(res);
      expect(sessions).toHaveLength(1);
      expect(sessions[0].id).toBe("s1");
      expect(sessions[0].name).toBe("Session One");
      expect(sessions[0].track_count).toBe(2);
    });
  });

  describe("when user has no sessions", () => {
    it("should return empty array", async () => {
      const res = await GET(new Request("http://localhost:6959/api/sessions"));
      expect(res.status).toBe(200);

      const sessions = await parseJson<unknown[]>(res);
      expect(sessions).toHaveLength(0);
    });
  });
});
