import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";
import type { TestRawDB } from "@/lib/db/test-helpers";
import type { DrizzleDB } from "@/lib/db";
import {
  createTestDrizzleDB,
  resetTestDB,
  seedTestUser,
  seedTestGame,
  seedTestTracks,
} from "@/lib/db/test-helpers";
import type { Game, TaggedTrack } from "@/types";
import { CurationMode, GameProgressStatus } from "@/types";
import type { GenerateEvent } from "../types";
import { TEST_USER_ID, TEST_GAME_ID, TEST_GAME_TITLE } from "@/test/constants";

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

beforeAll(async () => {
  ({ db, rawDb } = await createTestDrizzleDB());
});

beforeEach(async () => {
  await resetTestDB(rawDb);
  await seedTestUser(rawDb);
});

describe("fetchGameCandidates", () => {
  describe("when game has tagged tracks with video mappings", () => {
    let result: TaggedTrack[];
    let events: GenerateEvent[];

    beforeEach(async () => {
      events = [];
      const gameId = await seedTestGame(rawDb, TEST_USER_ID, {
        id: TEST_GAME_ID,
        title: TEST_GAME_TITLE,
      });
      await seedTestTracks(rawDb, gameId, 3, true);

      // Add video mappings for the tracks
      await rawDb
        .prepare(
          "INSERT INTO video_tracks (video_id, game_id, track_name, duration_seconds, view_count) VALUES (?, ?, ?, ?, ?)",
        )
        .run("vid-1", gameId, "Track 1", 200, 50000);
      await rawDb
        .prepare(
          "INSERT INTO video_tracks (video_id, game_id, track_name, duration_seconds, view_count) VALUES (?, ?, ?, ?, ?)",
        )
        .run("vid-2", gameId, "Track 2", 180, 30000);
      await rawDb
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
      const gameId = await seedTestGame(rawDb, TEST_USER_ID, { id: TEST_GAME_ID });
      await seedTestTracks(rawDb, gameId, 3, true);

      const result = await fetchGameCandidates(makeGame(TEST_GAME_ID, "Test"), vi.fn());
      expect(result).toHaveLength(0);
    });
  });

  describe("when game has no tracks", () => {
    it("should return empty array and emit a Done progress event", async () => {
      await seedTestGame(rawDb, TEST_USER_ID, { id: TEST_GAME_ID });
      const events: GenerateEvent[] = [];

      const result = await fetchGameCandidates(makeGame(TEST_GAME_ID, "Test"), (e) =>
        events.push(e),
      );
      expect(result).toHaveLength(0);
      const done = events[1] as { type: string; status: GameProgressStatus };
      expect(done.type).toBe("progress");
      expect(done.status).toBe(GameProgressStatus.Done);
    });
  });

  describe("when game has untagged tracks", () => {
    it("should not include untagged tracks", async () => {
      const gameId = await seedTestGame(rawDb, TEST_USER_ID, { id: TEST_GAME_ID });
      await seedTestTracks(rawDb, gameId, 3, false); // untagged

      const result = await fetchGameCandidates(makeGame(TEST_GAME_ID, "Test"), vi.fn());
      expect(result).toHaveLength(0);
    });
  });

  describe("when a tagged track has has_vocals = null in the DB", () => {
    it("should default hasVocals to false in the TaggedTrack", async () => {
      const gameId = await seedTestGame(rawDb, TEST_USER_ID, { id: TEST_GAME_ID });
      // Insert a tagged track with has_vocals explicitly null
      await rawDb
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
      await rawDb
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
      const gameId = await seedTestGame(rawDb, TEST_USER_ID, { id: TEST_GAME_ID });
      await seedTestTracks(rawDb, gameId, 2, true);
      // Deactivate one track
      await rawDb
        .prepare("UPDATE tracks SET active = false WHERE game_id = ? AND name = ?")
        .run(gameId, "Track 1");
      // Add video mapping for both
      await rawDb
        .prepare("INSERT INTO video_tracks (video_id, game_id, track_name) VALUES (?, ?, ?)")
        .run("vid-1", gameId, "Track 1");
      await rawDb
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
      const gameId = await seedTestGame(rawDb, TEST_USER_ID, {
        id: TEST_GAME_ID,
        title: TEST_GAME_TITLE,
      });
      await seedTestTracks(rawDb, gameId, 2, true);
      await rawDb
        .prepare(
          "INSERT INTO video_tracks (video_id, game_id, track_name, duration_seconds) VALUES (?, ?, ?, ?)",
        )
        .run("vid-1", gameId, "Track 1", 200);
      await rawDb
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
      await seedTestGame(rawDb, TEST_USER_ID, { id: TEST_GAME_ID });
      const result = await getTaggedPool(TEST_GAME_ID, TEST_GAME_TITLE);
      expect(result).toHaveLength(0);
    });
  });

  describe("when tracks have no video mappings", () => {
    it("should exclude them", async () => {
      const gameId = await seedTestGame(rawDb, TEST_USER_ID, { id: TEST_GAME_ID });
      await seedTestTracks(rawDb, gameId, 3, true);
      // Only map 1 of 3 tracks
      await rawDb
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
