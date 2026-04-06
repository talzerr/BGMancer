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

const { DELETE: DELETE_HANDLER } = await import("../route");

beforeEach(() => {
  ({ db, rawDb } = createTestDrizzleDB());
  seedTestUser(rawDb);
});

/** Insert a playlist track directly into the DB. */
function seedPlaylistTrack(
  db: Database.Database,
  playlistId: string,
  trackId: string,
  gameId: string,
  position: number,
): void {
  rawDb
    .prepare(
      `INSERT INTO playlist_tracks (id, playlist_id, game_id, track_name, position)
     VALUES (?, ?, ?, ?, ?)`,
    )
    .run(trackId, playlistId, gameId, `Track ${position}`, position);
}

describe("DELETE /api/playlist/[id]", () => {
  describe("when deleting a track", () => {
    it("should return success", async () => {
      const gameId = seedTestGame(rawDb, TEST_USER_ID, {
        id: TEST_GAME_ID,
        title: TEST_GAME_TITLE,
      });
      const playlistId = seedTestSession(rawDb, TEST_USER_ID, { id: "pl-1" });
      seedPlaylistTrack(rawDb, playlistId, "pt-1", gameId, 0);

      const res = await DELETE_HANDLER(makeJsonRequest("/api/playlist/pt-1", "DELETE"), {
        params: Promise.resolve({ id: "pt-1" }),
      });

      expect(res.status).toBe(200);
      const body = await parseJson<{ success: boolean }>(res);
      expect(body.success).toBe(true);
    });

    it("should remove the track from the database", async () => {
      const gameId = seedTestGame(rawDb, TEST_USER_ID, {
        id: TEST_GAME_ID,
        title: TEST_GAME_TITLE,
      });
      const playlistId = seedTestSession(rawDb, TEST_USER_ID, { id: "pl-1" });
      seedPlaylistTrack(rawDb, playlistId, "pt-1", gameId, 0);

      await DELETE_HANDLER(makeJsonRequest("/api/playlist/pt-1", "DELETE"), {
        params: Promise.resolve({ id: "pt-1" }),
      });

      const row = rawDb.prepare("SELECT id FROM playlist_tracks WHERE id = ?").get("pt-1");
      expect(row).toBeUndefined();
    });
  });

  describe("when deleting one track among many", () => {
    it("should NOT remove other tracks", async () => {
      const gameId = seedTestGame(rawDb, TEST_USER_ID, {
        id: TEST_GAME_ID,
        title: TEST_GAME_TITLE,
      });
      const playlistId = seedTestSession(rawDb, TEST_USER_ID, { id: "pl-1" });
      seedPlaylistTrack(rawDb, playlistId, "pt-1", gameId, 0);
      seedPlaylistTrack(rawDb, playlistId, "pt-2", gameId, 1);
      seedPlaylistTrack(rawDb, playlistId, "pt-3", gameId, 2);

      await DELETE_HANDLER(makeJsonRequest("/api/playlist/pt-2", "DELETE"), {
        params: Promise.resolve({ id: "pt-2" }),
      });

      const remaining = rawDb
        .prepare("SELECT id FROM playlist_tracks WHERE playlist_id = ? ORDER BY position")
        .all("pl-1") as Array<{ id: string }>;

      expect(remaining).toHaveLength(2);
      expect(remaining.map((r) => r.id)).toEqual(["pt-1", "pt-3"]);
    });
  });
});
