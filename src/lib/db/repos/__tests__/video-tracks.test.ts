import { describe, it, expect, vi, beforeEach } from "vitest";
import type Database from "better-sqlite3";
import type { DrizzleDB } from "@/lib/db";
import {
  createTestDrizzleDB,
  seedTestUser,
  seedTestGame,
  seedTestTracks,
} from "../../test-helpers";
let db: DrizzleDB;
let rawDb: Database.Database;

vi.mock("@/lib/db", async () => {
  const { MOCK_LOCAL_USER_ID, MOCK_LOCAL_LIBRARY_ID } = await import("@/test/constants");
  return {
    getDB: () => db,

    LOCAL_USER_ID: MOCK_LOCAL_USER_ID,
    LOCAL_LIBRARY_ID: MOCK_LOCAL_LIBRARY_ID,
  };
});

// Import after mock
const { VideoTracks } = await import("../video-tracks");

let userId: string;
let gameId: string;
let trackNames: string[];

beforeEach(() => {
  ({ db, rawDb } = createTestDrizzleDB());
  ({ userId } = seedTestUser(rawDb));
  gameId = seedTestGame(rawDb, userId, { id: "game-vt" });
  trackNames = seedTestTracks(rawDb, gameId, 3);
});

function getRawRow(videoId: string, gId: string): Record<string, unknown> | undefined {
  return rawDb
    .prepare("SELECT * FROM video_tracks WHERE video_id = ? AND game_id = ?")
    .get(videoId, gId) as Record<string, unknown> | undefined;
}

describe("VideoTracks", () => {
  describe("upsertBatch", () => {
    it("should insert new rows", async () => {
      await VideoTracks.upsertBatch([
        { videoId: "v1", gameId, trackName: trackNames[0] },
        { videoId: "v2", gameId, trackName: trackNames[1] },
      ]);

      const row1 = getRawRow("v1", gameId);
      const row2 = getRawRow("v2", gameId);

      expect(row1).toBeDefined();
      expect(row1!.track_name).toBe(trackNames[0]);
      expect(row2).toBeDefined();
      expect(row2!.track_name).toBe(trackNames[1]);
    });

    it("should update track_name on conflict", async () => {
      await VideoTracks.upsertBatch([{ videoId: "v1", gameId, trackName: trackNames[0] }]);
      await VideoTracks.upsertBatch([{ videoId: "v1", gameId, trackName: trackNames[1] }]);

      const row = getRawRow("v1", gameId);
      expect(row!.track_name).toBe(trackNames[1]);
    });

    it("should be a no-op when given an empty array", async () => {
      await VideoTracks.upsertBatch([]);

      const rows = rawDb.prepare("SELECT * FROM video_tracks WHERE game_id = ?").all(gameId);
      expect(rows).toHaveLength(0);
    });

    it("should allow null track_name", async () => {
      await VideoTracks.upsertBatch([{ videoId: "v-null", gameId, trackName: null }]);

      const row = getRawRow("v-null", gameId);
      expect(row).toBeDefined();
      expect(row!.track_name).toBeNull();
    });
  });

  describe("upsertSingle", () => {
    it("should create a new video track entry", async () => {
      await VideoTracks.upsertSingle(gameId, trackNames[0], {
        videoId: "v-single",
        durationSeconds: 180,
        viewCount: 5000,
      });

      const row = getRawRow("v-single", gameId);
      expect(row).toBeDefined();
      expect(row!.track_name).toBe(trackNames[0]);
      expect(row!.duration_seconds).toBe(180);
      expect(row!.view_count).toBe(5000);
    });

    it("should preserve existing duration via COALESCE on update", async () => {
      await VideoTracks.upsertSingle(gameId, trackNames[0], {
        videoId: "v-coalesce",
        durationSeconds: 200,
        viewCount: 1000,
      });

      // Update without providing duration — existing value should be preserved
      await VideoTracks.upsertSingle(gameId, trackNames[0], {
        videoId: "v-coalesce",
        viewCount: 2000,
      });

      const row = getRawRow("v-coalesce", gameId);
      expect(row!.duration_seconds).toBe(200);
      expect(row!.view_count).toBe(2000);
    });

    it("should preserve existing view_count via COALESCE when new value is null", async () => {
      await VideoTracks.upsertSingle(gameId, trackNames[0], {
        videoId: "v-vc",
        durationSeconds: 100,
        viewCount: 3000,
      });

      await VideoTracks.upsertSingle(gameId, trackNames[0], {
        videoId: "v-vc",
        durationSeconds: null,
        viewCount: null,
      });

      const row = getRawRow("v-vc", gameId);
      expect(row!.duration_seconds).toBe(100);
      expect(row!.view_count).toBe(3000);
    });

    it("should update track_name on conflict", async () => {
      await VideoTracks.upsertSingle(gameId, trackNames[0], { videoId: "v-rename" });
      await VideoTracks.upsertSingle(gameId, trackNames[1], { videoId: "v-rename" });

      const row = getRawRow("v-rename", gameId);
      expect(row!.track_name).toBe(trackNames[1]);
    });
  });

  describe("storeDurations", () => {
    it("should write duration and view_count for new entries", async () => {
      await VideoTracks.storeDurations([
        { videoId: "v-dur1", gameId, durationSeconds: 240, viewCount: 10000 },
      ]);

      const row = getRawRow("v-dur1", gameId);
      expect(row).toBeDefined();
      expect(row!.duration_seconds).toBe(240);
      expect(row!.view_count).toBe(10000);
      expect(row!.track_name).toBeNull();
    });

    it("should not overwrite existing duration (write-once via COALESCE)", async () => {
      await VideoTracks.storeDurations([
        { videoId: "v-wo", gameId, durationSeconds: 300, viewCount: 500 },
      ]);

      await VideoTracks.storeDurations([
        { videoId: "v-wo", gameId, durationSeconds: 999, viewCount: 1500 },
      ]);

      const row = getRawRow("v-wo", gameId);
      expect(row!.duration_seconds).toBe(300); // original preserved
    });

    it("should always refresh view_count", async () => {
      await VideoTracks.storeDurations([
        { videoId: "v-vc", gameId, durationSeconds: 300, viewCount: 500 },
      ]);

      await VideoTracks.storeDurations([
        { videoId: "v-vc", gameId, durationSeconds: 999, viewCount: 7777 },
      ]);

      const row = getRawRow("v-vc", gameId);
      expect(row!.view_count).toBe(7777); // refreshed
    });

    it("should be a no-op when given an empty array", async () => {
      await VideoTracks.storeDurations([]);

      const rows = rawDb.prepare("SELECT * FROM video_tracks WHERE game_id = ?").all(gameId);
      expect(rows).toHaveLength(0);
    });
  });

  describe("getByGame", () => {
    it("should return a map with correct structure", async () => {
      await VideoTracks.upsertBatch([
        { videoId: "v1", gameId, trackName: trackNames[0] },
        { videoId: "v2", gameId, trackName: null },
      ]);
      await VideoTracks.storeDurations([
        { videoId: "v1", gameId, durationSeconds: 120, viewCount: 3000 },
      ]);

      const map = await VideoTracks.getByGame(gameId);

      expect(map).toBeInstanceOf(Map);
      expect(map.size).toBe(2);

      const v1 = map.get("v1");
      expect(v1).toEqual({
        trackName: trackNames[0],
        durationSeconds: 120,
        viewCount: 3000,
      });

      const v2 = map.get("v2");
      expect(v2).toBeDefined();
      expect(v2!.trackName).toBeNull();
      expect(v2!.durationSeconds).toBeNull();
      expect(v2!.viewCount).toBeNull();
    });

    it("should return an empty map for an unknown game", async () => {
      const map = await VideoTracks.getByGame("nonexistent-game");

      expect(map).toBeInstanceOf(Map);
      expect(map.size).toBe(0);
    });
  });

  describe("getTrackToVideo", () => {
    it("should return only entries with non-null track_name", async () => {
      await VideoTracks.upsertBatch([
        { videoId: "v1", gameId, trackName: trackNames[0] },
        { videoId: "v2", gameId, trackName: null },
        { videoId: "v3", gameId, trackName: trackNames[2] },
      ]);

      const map = await VideoTracks.getTrackToVideo(gameId);

      expect(map).toBeInstanceOf(Map);
      expect(map.size).toBe(2);
      expect(map.get(trackNames[0])).toBe("v1");
      expect(map.get(trackNames[2])).toBe("v3");
      expect(map.has(trackNames[1])).toBe(false);
    });

    it("should return an empty map for a game with no video tracks", async () => {
      const map = await VideoTracks.getTrackToVideo(gameId);

      expect(map).toBeInstanceOf(Map);
      expect(map.size).toBe(0);
    });

    it("should not return entries from a different game", async () => {
      const otherGameId = seedTestGame(rawDb, userId, { id: "game-vt-other" });
      const otherTracks = seedTestTracks(rawDb, otherGameId, 1);

      await VideoTracks.upsertBatch([
        { videoId: "v1", gameId, trackName: trackNames[0] },
        { videoId: "v-other", gameId: otherGameId, trackName: otherTracks[0] },
      ]);

      const map = await VideoTracks.getTrackToVideo(gameId);

      expect(map.size).toBe(1);
      expect(map.get(trackNames[0])).toBe("v1");
    });
  });
});
