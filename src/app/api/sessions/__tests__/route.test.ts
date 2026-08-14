import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";
import type { TestRawDB } from "@/lib/db/test-helpers";
import type { DrizzleDB } from "@/lib/db";
import {
  createTestDrizzleDB,
  resetTestDB,
  seedTestUser,
  seedTestGame,
  seedTestSession,
} from "@/lib/db/test-helpers";
import { TEST_USER_ID, TEST_GAME_ID, TEST_GAME_TITLE } from "@/test/constants";
import { parseJson } from "@/test/route-helpers";

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

describe("GET /api/sessions", () => {
  describe("when user has sessions", () => {
    it("should return sessions with track counts", async () => {
      await seedTestGame(rawDb, TEST_USER_ID, { id: TEST_GAME_ID, title: TEST_GAME_TITLE });
      const sessionId = await seedTestSession(rawDb, TEST_USER_ID, {
        id: "s1",
        name: "Session One",
      });

      // Add some tracks to the session
      await rawDb
        .prepare(
          `INSERT INTO playlist_tracks (id, playlist_id, game_id, track_name, position)
         VALUES (?, ?, ?, ?, ?)`,
        )
        .run("pt1", sessionId, TEST_GAME_ID, "Track 1", 0);
      await rawDb
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
