import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";
import type { TestRawDB } from "@/lib/db/test-helpers";
import type { DrizzleDB } from "@/lib/db";
import { NextRequest } from "next/server";
import {
  createTestDrizzleDB,
  resetTestDB,
  seedTestUser,
  seedTestGame,
  seedTestSession,
} from "@/lib/db/test-helpers";
import { TEST_USER_ID, TEST_GAME_ID, TEST_GAME_TITLE } from "@/test/constants";
import { parseJson } from "@/test/route-helpers";

const BASE_URL = "http://localhost:6959";

/** Build a NextRequest (the playlist route uses req.nextUrl, so plain Request won't work). */
function makeNextRequest(
  path: string,
  opts?: { method?: string; params?: Record<string, string>; body?: unknown },
): NextRequest {
  const url = new URL(path, BASE_URL);
  if (opts?.params) {
    for (const [key, value] of Object.entries(opts.params)) {
      url.searchParams.set(key, value);
    }
  }
  const init: { method: string; headers?: Record<string, string>; body?: string } = {
    method: opts?.method ?? "GET",
  };
  if (opts?.body !== undefined) {
    init.headers = { "Content-Type": "application/json" };
    init.body = JSON.stringify(opts.body);
  }
  return new NextRequest(url.toString(), init);
}

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

const { GET, DELETE: DELETE_HANDLER } = await import("../route");

beforeAll(async () => {
  ({ db, rawDb } = await createTestDrizzleDB());
});

beforeEach(async () => {
  await resetTestDB(rawDb);
  await seedTestUser(rawDb);
});

/** Inserts a playlist track directly into the DB. */
async function insertPlaylistTrack(
  id: string,
  playlistId: string,
  gameId: string,
  opts: { trackName?: string; videoId?: string; position?: number } = {},
): Promise<void> {
  await rawDb
    .prepare(
      `INSERT INTO playlist_tracks (id, playlist_id, game_id, track_name, video_id, position)
     VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(
      id,
      playlistId,
      gameId,
      opts.trackName ?? "Track",
      opts.videoId ?? "vid-1",
      opts.position ?? 0,
    );
}

describe("GET /api/playlist", () => {
  describe("when user has an active session with tracks", () => {
    it("should return tracks with game titles", async () => {
      await seedTestGame(rawDb, TEST_USER_ID, { id: TEST_GAME_ID, title: TEST_GAME_TITLE });
      const sessionId = await seedTestSession(rawDb, TEST_USER_ID, { id: "s1" });

      await insertPlaylistTrack("pt1", sessionId, TEST_GAME_ID, {
        trackName: "Firelink Shrine",
        position: 0,
      });
      await insertPlaylistTrack("pt2", sessionId, TEST_GAME_ID, {
        trackName: "Gwyn's Theme",
        position: 1,
      });

      const res = await GET(makeNextRequest("/api/playlist"));
      expect(res.status).toBe(200);

      const tracks =
        await parseJson<Array<{ id: string; track_name: string; game_title: string }>>(res);
      expect(tracks).toHaveLength(2);
      expect(tracks[0].game_title).toBe(TEST_GAME_TITLE);
    });
  });

  describe("when no active session", () => {
    it("should return empty array", async () => {
      const res = await GET(makeNextRequest("/api/playlist"));
      expect(res.status).toBe(200);

      const tracks = await parseJson<unknown[]>(res);
      expect(tracks).toHaveLength(0);
    });
  });

  describe("when sessionId param is passed", () => {
    it("should return tracks for that session", async () => {
      await seedTestGame(rawDb, TEST_USER_ID, { id: TEST_GAME_ID, title: TEST_GAME_TITLE });
      const session1 = await seedTestSession(rawDb, TEST_USER_ID, { id: "s1", name: "Session 1" });
      const session2 = await seedTestSession(rawDb, TEST_USER_ID, { id: "s2", name: "Session 2" });

      await insertPlaylistTrack("pt1", session1, TEST_GAME_ID, {
        trackName: "Track A",
        position: 0,
      });
      await insertPlaylistTrack("pt2", session2, TEST_GAME_ID, {
        trackName: "Track B",
        position: 0,
      });

      // Request tracks for s1 specifically (even though s2 is the active/latest session)
      const res = await GET(makeNextRequest("/api/playlist", { params: { sessionId: "s1" } }));
      expect(res.status).toBe(200);

      const tracks = await parseJson<Array<{ id: string; track_name: string }>>(res);
      expect(tracks).toHaveLength(1);
      expect(tracks[0].track_name).toBe("Track A");
    });
  });
});

describe("DELETE /api/playlist", () => {
  describe("when clearing tracks", () => {
    it("should clear all tracks from active session", async () => {
      await seedTestGame(rawDb, TEST_USER_ID, { id: TEST_GAME_ID, title: TEST_GAME_TITLE });
      const sessionId = await seedTestSession(rawDb, TEST_USER_ID, { id: "s1" });

      await insertPlaylistTrack("pt1", sessionId, TEST_GAME_ID, { position: 0 });
      await insertPlaylistTrack("pt2", sessionId, TEST_GAME_ID, { position: 1 });

      const res = await DELETE_HANDLER(
        new Request("http://localhost:6959/api/playlist", { method: "DELETE" }),
      );
      expect(res.status).toBe(200);

      const body = await parseJson<{ success: boolean }>(res);
      expect(body.success).toBe(true);

      // Verify tracks are gone
      const remaining = (await rawDb
        .prepare("SELECT COUNT(*) AS cnt FROM playlist_tracks WHERE playlist_id = ?")
        .get(sessionId)) as { cnt: number };
      expect(remaining.cnt).toBe(0);
    });
  });
});
