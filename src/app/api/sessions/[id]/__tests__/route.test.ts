import { describe, it, expect, vi, beforeEach } from "vitest";
import type Database from "better-sqlite3";
import type { DrizzleDB } from "@/lib/db";
import { createTestDrizzleDB, seedTestUser, seedTestSession } from "@/lib/db/test-helpers";
import { TEST_USER_ID } from "@/test/constants";
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

vi.mock("@/lib/services/auth-helpers", async () => {
  const { TEST_USER_ID } = await import("@/test/constants");
  return {
    getAuthUserId: async () => TEST_USER_ID,
    getAuthSession: async () => ({ authenticated: true, userId: TEST_USER_ID }),
    AuthRequiredError: class extends Error {},
  };
});

const { PATCH, DELETE: DELETE_HANDLER } = await import("../route");

beforeEach(() => {
  ({ db, rawDb } = createTestDrizzleDB());
  seedTestUser(rawDb);
});

/** Helper to build the async params object expected by Next.js 16 route handlers. */
function makeParams(id: string): { params: Promise<{ id: string }> } {
  return { params: Promise.resolve({ id }) };
}

describe("PATCH /api/sessions/[id]", () => {
  describe("when renaming a session", () => {
    it("should return success", async () => {
      const sessionId = seedTestSession(rawDb, TEST_USER_ID, { id: "s1", name: "Old Name" });

      const res = await PATCH(
        makeJsonRequest(`/api/sessions/${sessionId}`, "PATCH", { name: "New Name" }),
        makeParams(sessionId),
      );
      expect(res.status).toBe(200);

      const body = await parseJson<{ success: boolean }>(res);
      expect(body.success).toBe(true);

      // Verify the rename persisted
      const row = rawDb.prepare("SELECT name FROM playlists WHERE id = ?").get(sessionId) as {
        name: string;
      };
      expect(row.name).toBe("New Name");
    });
  });

  describe("when name is missing", () => {
    it("should return 400", async () => {
      const sessionId = seedTestSession(rawDb, TEST_USER_ID, { id: "s1" });

      const res = await PATCH(
        makeJsonRequest(`/api/sessions/${sessionId}`, "PATCH", {}),
        makeParams(sessionId),
      );
      expect(res.status).toBe(400);

      const body = await parseJson<{ error: string }>(res);
      expect(body.error).toMatch(/name/i);
    });
  });

  describe("when session doesn't exist", () => {
    it("should return 404", async () => {
      const res = await PATCH(
        makeJsonRequest("/api/sessions/nonexistent", "PATCH", { name: "New Name" }),
        makeParams("nonexistent"),
      );
      expect(res.status).toBe(404);
    });
  });
});

describe("DELETE /api/sessions/[id]", () => {
  describe("when deleting a session", () => {
    it("should return success with nextSessionId", async () => {
      seedTestSession(rawDb, TEST_USER_ID, { id: "s1", name: "First" });
      seedTestSession(rawDb, TEST_USER_ID, { id: "s2", name: "Second" });

      const res = await DELETE_HANDLER(
        makeJsonRequest("/api/sessions/s1", "DELETE"),
        makeParams("s1"),
      );
      expect(res.status).toBe(200);

      const body = await parseJson<{ success: boolean; nextSessionId: string | null }>(res);
      expect(body.success).toBe(true);
      // s2 should remain as the next active session
      expect(body.nextSessionId).toBe("s2");
    });
  });

  describe("when session doesn't exist", () => {
    it("should return 404", async () => {
      const res = await DELETE_HANDLER(
        makeJsonRequest("/api/sessions/nonexistent", "DELETE"),
        makeParams("nonexistent"),
      );
      expect(res.status).toBe(404);
    });
  });
});
