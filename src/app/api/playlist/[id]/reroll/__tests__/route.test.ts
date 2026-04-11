import { describe, it, expect, vi, beforeEach } from "vitest";
import type Database from "better-sqlite3";
import type { DrizzleDB } from "@/lib/db";
import {
  createTestDrizzleDB,
  seedTestUser,
  seedTestGame,
  seedTestSession,
} from "@/lib/db/test-helpers";
import { TEST_USER_ID } from "@/test/constants";
import { makeJsonRequest, parseJson } from "@/test/route-helpers";
import { PlaylistMode, TrackInstrumentation, TrackMood, TrackRole } from "@/types";
import type { TaggedTrack } from "@/types";

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

const taggedPool: TaggedTrack[] = [];
vi.mock("@/lib/pipeline/generation/candidates", () => ({
  getTaggedPool: vi.fn(async () => taggedPool),
}));

const { POST } = await import("../route");

function makeTrack(overrides: Partial<TaggedTrack> = {}): TaggedTrack {
  return {
    videoId: `vid-${Math.random().toString(36).slice(2, 8)}`,
    title: "Track",
    gameId: "g1",
    gameTitle: "Test Game",
    energy: 2,
    roles: [TrackRole.Ambient],
    moods: [TrackMood.Peaceful],
    instrumentation: [TrackInstrumentation.Piano],
    hasVocals: false,
    durationSeconds: 180,
    viewCount: null,
    ...overrides,
  };
}

function seedPlaylistTrack(playlistId: string, trackId: string, gameId: string, position: number) {
  rawDb
    .prepare(
      `INSERT INTO playlist_tracks (id, playlist_id, game_id, track_name, video_id, position, duration_seconds)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      trackId,
      playlistId,
      gameId,
      `Track ${position}`,
      `vid-existing-${position}`,
      position,
      180,
    );
}

beforeEach(() => {
  ({ db, rawDb } = createTestDrizzleDB());
  seedTestUser(rawDb);
  taggedPool.length = 0;
});

describe("POST /api/playlist/[id]/reroll", () => {
  describe("when the playlist is in Journey mode", () => {
    it("should accept any energy level for the replacement", async () => {
      seedTestGame(rawDb, TEST_USER_ID, { id: "g1" });
      const playlistId = seedTestSession(rawDb, TEST_USER_ID, {
        id: "pl-journey",
        playlistMode: PlaylistMode.Journey,
      });
      seedPlaylistTrack(playlistId, "pt-1", "g1", 0);

      taggedPool.push(
        makeTrack({ videoId: "vid-low", energy: 1 }),
        makeTrack({ videoId: "vid-mid", energy: 2 }),
        makeTrack({ videoId: "vid-high", energy: 3 }),
      );

      const res = await POST(
        makeJsonRequest("/api/playlist/pt-1/reroll", "POST", {
          allowLongTracks: true,
          allowShortTracks: true,
        }),
        { params: Promise.resolve({ id: "pt-1" }) },
      );

      expect(res.status).toBe(200);
      const body = await parseJson<{ track: { video_id: string } }>(res);
      expect(["vid-low", "vid-mid", "vid-high"]).toContain(body.track.video_id);
    });
  });

  describe("when the playlist is in Chill mode", () => {
    it("should never return an energy-3 replacement", async () => {
      seedTestGame(rawDb, TEST_USER_ID, { id: "g1" });
      const playlistId = seedTestSession(rawDb, TEST_USER_ID, {
        id: "pl-chill",
        playlistMode: PlaylistMode.Chill,
      });
      seedPlaylistTrack(playlistId, "pt-1", "g1", 0);

      taggedPool.push(
        makeTrack({ videoId: "vid-low", energy: 1 }),
        makeTrack({ videoId: "vid-mid", energy: 2 }),
        makeTrack({ videoId: "vid-high", energy: 3 }),
      );

      const res = await POST(
        makeJsonRequest("/api/playlist/pt-1/reroll", "POST", {
          allowLongTracks: true,
          allowShortTracks: true,
        }),
        { params: Promise.resolve({ id: "pt-1" }) },
      );

      expect(res.status).toBe(200);
      const body = await parseJson<{ track: { video_id: string } }>(res);
      expect(body.track.video_id).not.toBe("vid-high");
    });

    it("should return 409 when the only candidate is energy-3", async () => {
      seedTestGame(rawDb, TEST_USER_ID, { id: "g1" });
      const playlistId = seedTestSession(rawDb, TEST_USER_ID, {
        id: "pl-chill",
        playlistMode: PlaylistMode.Chill,
      });
      seedPlaylistTrack(playlistId, "pt-1", "g1", 0);

      taggedPool.push(makeTrack({ videoId: "vid-high", energy: 3 }));

      const res = await POST(
        makeJsonRequest("/api/playlist/pt-1/reroll", "POST", {
          allowLongTracks: true,
          allowShortTracks: true,
        }),
        { params: Promise.resolve({ id: "pt-1" }) },
      );

      expect(res.status).toBe(409);
    });
  });

  describe("when the playlist is in Rush mode", () => {
    it("should never return an energy-1 replacement", async () => {
      seedTestGame(rawDb, TEST_USER_ID, { id: "g1" });
      const playlistId = seedTestSession(rawDb, TEST_USER_ID, {
        id: "pl-rush",
        playlistMode: PlaylistMode.Rush,
      });
      seedPlaylistTrack(playlistId, "pt-1", "g1", 0);

      taggedPool.push(
        makeTrack({ videoId: "vid-low", energy: 1 }),
        makeTrack({ videoId: "vid-mid", energy: 2 }),
        makeTrack({ videoId: "vid-high", energy: 3 }),
      );

      const res = await POST(
        makeJsonRequest("/api/playlist/pt-1/reroll", "POST", {
          allowLongTracks: true,
          allowShortTracks: true,
        }),
        { params: Promise.resolve({ id: "pt-1" }) },
      );

      expect(res.status).toBe(200);
      const body = await parseJson<{ track: { video_id: string } }>(res);
      expect(body.track.video_id).not.toBe("vid-low");
    });
  });
});
