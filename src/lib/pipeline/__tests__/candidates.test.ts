import { describe, it, expect, vi, beforeEach } from "vitest";
import type Database from "better-sqlite3";
import type { DrizzleDB } from "@/lib/db";
import {
  createTestDrizzleDB,
  seedTestUser,
  seedTestGame,
  seedTestTracks,
} from "@/lib/db/test-helpers";
import type { Game, TaggedTrack } from "@/types";
import { CurationMode, GameProgressStatus } from "@/types";
import type { GenerateEvent } from "../types";
import { TEST_USER_ID, TEST_GAME_ID, TEST_GAME_TITLE } from "@/test/constants";

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

const { fetchGameCandidates, getTaggedPool } = await import("../candidates");

function makeGame(id: string, title: string): Game {
  return {
    id,
    title,
    curation: CurationMode.Include,
    steam_appid: null,
    onboarding_phase: "tagged",
    published: true,
    tracklist_source: null,
    yt_playlist_id: null,
    thumbnail_url: null,
    needs_review: false,
    created_at: "",
    updated_at: "",
  } as Game;
}

beforeEach(() => {
  ({ db, rawDb } = createTestDrizzleDB());
  seedTestUser(rawDb);
});

describe("fetchGameCandidates", () => {
  describe("when game has tagged tracks with video mappings", () => {
    let result: TaggedTrack[];
    let events: GenerateEvent[];

    beforeEach(async () => {
      events = [];
      const gameId = seedTestGame(rawDb, TEST_USER_ID, {
        id: TEST_GAME_ID,
        title: TEST_GAME_TITLE,
      });
      seedTestTracks(rawDb, gameId, 3, true);

      // Add video mappings for the tracks
      rawDb
        .prepare(
          "INSERT INTO video_tracks (video_id, game_id, track_name, duration_seconds, view_count) VALUES (?, ?, ?, ?, ?)",
        )
        .run("vid-1", gameId, "Track 1", 200, 50000);
      rawDb
        .prepare(
          "INSERT INTO video_tracks (video_id, game_id, track_name, duration_seconds, view_count) VALUES (?, ?, ?, ?, ?)",
        )
        .run("vid-2", gameId, "Track 2", 180, 30000);
      rawDb
        .prepare(
          "INSERT INTO video_tracks (video_id, game_id, track_name, duration_seconds, view_count) VALUES (?, ?, ?, ?, ?)",
        )
        .run("vid-3", gameId, "Track 3", 240, null);

      result = await fetchGameCandidates(makeGame(TEST_GAME_ID, TEST_GAME_TITLE), (e) =>
        events.push(e),
      );
    });

    it("should return TaggedTrack entries for tracks with video mappings", () => {
      expect(result).toHaveLength(3);
    });

    it("should map video metadata correctly", () => {
      const track1 = result.find((t) => t.videoId === "vid-1");
      expect(track1).toBeDefined();
      expect(track1!.durationSeconds).toBe(200);
      expect(track1!.viewCount).toBe(50000);
      expect(track1!.gameId).toBe(TEST_GAME_ID);
      expect(track1!.gameTitle).toBe(TEST_GAME_TITLE);
    });

    it("should set viewCount to null when not available", () => {
      const track3 = result.find((t) => t.videoId === "vid-3");
      expect(track3!.viewCount).toBeNull();
    });

    it("should send progress events", () => {
      expect(events).toHaveLength(2);
      expect(events[0].type).toBe("progress");
      expect((events[0] as { status: string }).status).toBe(GameProgressStatus.Active);
      expect((events[1] as { status: string }).status).toBe(GameProgressStatus.Done);
    });
  });

  describe("when game has tagged tracks but no video mappings", () => {
    it("should return empty array", async () => {
      const gameId = seedTestGame(rawDb, TEST_USER_ID, { id: TEST_GAME_ID });
      seedTestTracks(rawDb, gameId, 3, true);

      const result = await fetchGameCandidates(makeGame(TEST_GAME_ID, "Test"), vi.fn());
      expect(result).toHaveLength(0);
    });
  });

  describe("when game has no tracks", () => {
    it("should return empty array with done status", async () => {
      seedTestGame(rawDb, TEST_USER_ID, { id: TEST_GAME_ID });
      const events: GenerateEvent[] = [];

      const result = await fetchGameCandidates(makeGame(TEST_GAME_ID, "Test"), (e) =>
        events.push(e),
      );
      expect(result).toHaveLength(0);
      expect((events[1] as { message: string }).message).toContain("No active tagged tracks");
    });
  });

  describe("when game has untagged tracks", () => {
    it("should not include untagged tracks", async () => {
      const gameId = seedTestGame(rawDb, TEST_USER_ID, { id: TEST_GAME_ID });
      seedTestTracks(rawDb, gameId, 3, false); // untagged

      const result = await fetchGameCandidates(makeGame(TEST_GAME_ID, "Test"), vi.fn());
      expect(result).toHaveLength(0);
    });
  });

  describe("when a tagged track has has_vocals = null in the DB", () => {
    it("should default hasVocals to false in the TaggedTrack", async () => {
      const gameId = seedTestGame(rawDb, TEST_USER_ID, { id: TEST_GAME_ID });
      // Insert a tagged track with has_vocals explicitly null
      rawDb
        .prepare(
          `INSERT INTO tracks (game_id, name, position, energy, roles, moods, instrumentation, has_vocals, tagged_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          gameId,
          "Null Vocal Track",
          0,
          2,
          '["ambient"]',
          '["peaceful"]',
          '["piano"]',
          null,
          new Date().toISOString(),
        );

      // Add video mapping
      rawDb
        .prepare(
          "INSERT INTO video_tracks (video_id, game_id, track_name, duration_seconds) VALUES (?, ?, ?, ?)",
        )
        .run("vid-null-vocal", gameId, "Null Vocal Track", 200);

      const result = await fetchGameCandidates(makeGame(TEST_GAME_ID, "Test"), vi.fn());
      expect(result).toHaveLength(1);
      expect(result[0].hasVocals).toBe(false);
    });
  });

  describe("when game has inactive tracks", () => {
    it("should not include inactive tracks", async () => {
      const gameId = seedTestGame(rawDb, TEST_USER_ID, { id: TEST_GAME_ID });
      seedTestTracks(rawDb, gameId, 2, true);
      // Deactivate one track
      rawDb
        .prepare("UPDATE tracks SET active = 0 WHERE game_id = ? AND name = ?")
        .run(gameId, "Track 1");
      // Add video mapping for both
      rawDb
        .prepare("INSERT INTO video_tracks (video_id, game_id, track_name) VALUES (?, ?, ?)")
        .run("vid-1", gameId, "Track 1");
      rawDb
        .prepare("INSERT INTO video_tracks (video_id, game_id, track_name) VALUES (?, ?, ?)")
        .run("vid-2", gameId, "Track 2");

      const result = await fetchGameCandidates(makeGame(TEST_GAME_ID, "Test"), vi.fn());
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe("Track 2");
    });
  });
});

describe("getTaggedPool", () => {
  describe("when game has tagged tracks with video mappings", () => {
    it("should return TaggedTrack entries without requiring SSE callback", async () => {
      const gameId = seedTestGame(rawDb, TEST_USER_ID, {
        id: TEST_GAME_ID,
        title: TEST_GAME_TITLE,
      });
      seedTestTracks(rawDb, gameId, 2, true);
      rawDb
        .prepare(
          "INSERT INTO video_tracks (video_id, game_id, track_name, duration_seconds) VALUES (?, ?, ?, ?)",
        )
        .run("vid-1", gameId, "Track 1", 200);
      rawDb
        .prepare(
          "INSERT INTO video_tracks (video_id, game_id, track_name, duration_seconds) VALUES (?, ?, ?, ?)",
        )
        .run("vid-2", gameId, "Track 2", 180);

      const result = await getTaggedPool(TEST_GAME_ID, TEST_GAME_TITLE);
      expect(result).toHaveLength(2);
      expect(result[0].gameId).toBe(TEST_GAME_ID);
      expect(result[0].gameTitle).toBe(TEST_GAME_TITLE);
      expect(result[0].videoId).toBeDefined();
    });
  });

  describe("when game has no active tagged tracks", () => {
    it("should return empty array", async () => {
      seedTestGame(rawDb, TEST_USER_ID, { id: TEST_GAME_ID });
      const result = await getTaggedPool(TEST_GAME_ID, TEST_GAME_TITLE);
      expect(result).toHaveLength(0);
    });
  });

  describe("when tracks have no video mappings", () => {
    it("should exclude them", async () => {
      const gameId = seedTestGame(rawDb, TEST_USER_ID, { id: TEST_GAME_ID });
      seedTestTracks(rawDb, gameId, 3, true);
      // Only map 1 of 3 tracks
      rawDb
        .prepare(
          "INSERT INTO video_tracks (video_id, game_id, track_name, duration_seconds) VALUES (?, ?, ?, ?)",
        )
        .run("vid-1", gameId, "Track 1", 200);

      const result = await getTaggedPool(TEST_GAME_ID, TEST_GAME_TITLE);
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe("Track 1");
    });
  });
});
