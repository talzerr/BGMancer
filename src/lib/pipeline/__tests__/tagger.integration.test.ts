import { describe, it, expect, vi, beforeEach } from "vitest";
import type Database from "better-sqlite3";
import type { DrizzleDB } from "@/lib/db";
import {
  createTestDrizzleDB,
  seedTestUser,
  seedTestGame,
  seedTestTracks,
} from "@/lib/db/test-helpers";
import type { Track } from "@/types";
import type { LLMProvider } from "@/lib/llm/provider";
import { TEST_USER_ID, TEST_GAME_ID, TEST_GAME_TITLE } from "@/test/constants";

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

const { tagTracks } = await import("../tagger");
const { Tracks, ReviewFlags } = await import("@/lib/db/repo");

function mockProvider(response: string): LLMProvider {
  return { complete: vi.fn().mockResolvedValue(response) };
}

function failingProvider(): LLMProvider {
  return { complete: vi.fn().mockRejectedValue(new Error("API down")) };
}

beforeEach(() => {
  ({ db, rawDb } = createTestDrizzleDB());
  seedTestUser(rawDb);
});

describe("tagTracks (integration)", () => {
  let gameId: string;
  let tracks: Track[];

  beforeEach(async () => {
    gameId = seedTestGame(rawDb, TEST_USER_ID, { id: TEST_GAME_ID, title: TEST_GAME_TITLE });
    seedTestTracks(rawDb, gameId, 3, false);
    tracks = await Tracks.getByGame(gameId);
  });

  describe("when the LLM returns valid tags for all tracks", () => {
    beforeEach(async () => {
      const response = JSON.stringify([
        {
          index: 1,
          energy: 2,
          roles: ["ambient"],
          moods: ["peaceful"],
          instrumentation: ["piano"],
          hasVocals: false,
          confident: true,
        },
        {
          index: 2,
          energy: 3,
          roles: ["combat"],
          moods: ["epic", "tense"],
          instrumentation: ["orchestral"],
          hasVocals: false,
          confident: true,
        },
        {
          index: 3,
          energy: 1,
          roles: ["closer"],
          moods: ["melancholic"],
          instrumentation: ["strings"],
          hasVocals: true,
          confident: true,
        },
      ]);
      await tagTracks(gameId, TEST_GAME_TITLE, tracks, mockProvider(response));
    });

    it("should persist tags to all tracks in the DB", async () => {
      const updated = await Tracks.getByGame(gameId);
      const tagged = updated.filter((t) => t.taggedAt !== null);
      expect(tagged).toHaveLength(3);
    });

    it("should set correct energy values", async () => {
      const updated = await Tracks.getByGame(gameId);
      expect(updated[0].energy).toBe(2);
      expect(updated[1].energy).toBe(3);
      expect(updated[2].energy).toBe(1);
    });

    it("should set correct roles", async () => {
      const updated = await Tracks.getByGame(gameId);
      expect(updated[0].roles).toContain("ambient");
      expect(updated[1].roles).toContain("combat");
    });

    it("should not create any review flags", async () => {
      const flags = await ReviewFlags.listByGame(gameId);
      expect(flags).toHaveLength(0);
    });
  });

  describe("when the LLM returns invalid energy for a track", () => {
    beforeEach(async () => {
      const response = JSON.stringify([
        {
          index: 1,
          energy: 2,
          roles: ["ambient"],
          moods: ["peaceful"],
          instrumentation: ["piano"],
          hasVocals: false,
          confident: true,
        },
        {
          index: 2,
          energy: 99,
          roles: ["combat"],
          moods: ["epic"],
          instrumentation: ["orchestral"],
          hasVocals: false,
          confident: true,
        },
        {
          index: 3,
          energy: 1,
          roles: ["closer"],
          moods: ["melancholic"],
          instrumentation: ["strings"],
          hasVocals: false,
          confident: true,
        },
      ]);
      await tagTracks(gameId, TEST_GAME_TITLE, tracks, mockProvider(response));
    });

    it("should tag valid tracks and skip the invalid one", async () => {
      const updated = await Tracks.getByGame(gameId);
      const tagged = updated.filter((t) => t.taggedAt !== null);
      expect(tagged).toHaveLength(2);
    });

    it("should create a review flag for the invalid track", async () => {
      const flags = await ReviewFlags.listByGame(gameId);
      expect(flags.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("when the LLM returns a low-confidence tag", () => {
    beforeEach(async () => {
      const response = JSON.stringify([
        {
          index: 1,
          energy: 2,
          roles: ["ambient"],
          moods: ["peaceful"],
          instrumentation: ["piano"],
          hasVocals: false,
          confident: false,
        },
      ]);
      await tagTracks(gameId, TEST_GAME_TITLE, [tracks[0]], mockProvider(response));
    });

    it("should still persist the tags", async () => {
      const updated = await Tracks.getByGame(gameId);
      expect(updated[0].taggedAt).not.toBeNull();
    });

    it("should create a low-confidence review flag", async () => {
      const flags = await ReviewFlags.listByGame(gameId);
      expect(flags.some((f) => f.reason === "low_confidence")).toBe(true);
    });
  });

  describe("when the LLM returns malformed JSON", () => {
    beforeEach(async () => {
      await tagTracks(gameId, TEST_GAME_TITLE, tracks, mockProvider("not valid json at all"));
    });

    it("should not tag any tracks", async () => {
      const updated = await Tracks.getByGame(gameId);
      const tagged = updated.filter((t) => t.taggedAt !== null);
      expect(tagged).toHaveLength(0);
    });

    it("should create a parse-failed review flag", async () => {
      const flags = await ReviewFlags.listByGame(gameId);
      expect(flags.some((f) => f.reason === "llm_parse_failed")).toBe(true);
    });
  });

  describe("when the LLM call fails entirely", () => {
    beforeEach(async () => {
      await tagTracks(gameId, TEST_GAME_TITLE, tracks, failingProvider());
    });

    it("should not tag any tracks", async () => {
      const updated = await Tracks.getByGame(gameId);
      const tagged = updated.filter((t) => t.taggedAt !== null);
      expect(tagged).toHaveLength(0);
    });

    it("should create an llm-call-failed review flag", async () => {
      const flags = await ReviewFlags.listByGame(gameId);
      expect(flags.some((f) => f.reason === "llm_call_failed")).toBe(true);
    });
  });

  describe("when untagged track count exceeds TAG_POOL_MAX", () => {
    it("should create a TrackCapReached review flag", async () => {
      const bigGameId = seedTestGame(rawDb, TEST_USER_ID, { id: "big-game", title: "Big Game" });
      seedTestTracks(rawDb, bigGameId, 85, false);
      const bigTracks = await Tracks.getByGame(bigGameId);

      // Build a response array that covers all 80 tracks (capped at TAG_POOL_MAX)
      const tagResponse = JSON.stringify(
        Array.from({ length: 80 }, (_, i) => ({
          index: i + 1,
          energy: 2,
          roles: ["ambient"],
          moods: ["peaceful"],
          instrumentation: ["piano"],
          hasVocals: false,
          confident: true,
        })),
      );
      await tagTracks(bigGameId, "Big Game", bigTracks, mockProvider(tagResponse));

      const flags = await ReviewFlags.listByGame(bigGameId);
      expect(flags.some((f) => f.reason === "track_cap_reached")).toBe(true);
    });

    it("should only tag up to TAG_POOL_MAX tracks", async () => {
      const { TAG_POOL_MAX } = await import("@/lib/constants");
      const bigGameId = seedTestGame(rawDb, TEST_USER_ID, {
        id: "big-game-2",
        title: "Big Game 2",
      });
      seedTestTracks(rawDb, bigGameId, 85, false);
      const bigTracks = await Tracks.getByGame(bigGameId);

      const tagResponse = JSON.stringify(
        Array.from({ length: TAG_POOL_MAX }, (_, i) => ({
          index: i + 1,
          energy: 2,
          roles: ["ambient"],
          moods: ["peaceful"],
          instrumentation: ["piano"],
          hasVocals: false,
          confident: true,
        })),
      );
      await tagTracks(bigGameId, "Big Game 2", bigTracks, mockProvider(tagResponse));

      const updated = await Tracks.getByGame(bigGameId);
      const tagged = updated.filter((t) => t.taggedAt !== null);
      expect(tagged).toHaveLength(TAG_POOL_MAX);
    });
  });

  describe("when there are no untagged tracks", () => {
    it("should return immediately without calling the provider", async () => {
      // Tag all tracks first
      seedTestTracks(rawDb, gameId, 0); // no-op, tracks already seeded
      const taggedTracks = await Tracks.getByGame(gameId);
      const response = JSON.stringify(
        taggedTracks.map((t, i) => ({
          index: i + 1,
          energy: 2,
          roles: ["ambient"],
          moods: ["peaceful"],
          instrumentation: ["piano"],
          hasVocals: false,
          confident: true,
        })),
      );
      const provider = mockProvider(response);
      await tagTracks(gameId, TEST_GAME_TITLE, taggedTracks, provider);

      // Now try again — all tracks are tagged
      const provider2 = mockProvider("should not be called");
      const allTagged = await Tracks.getByGame(gameId);
      await tagTracks(gameId, TEST_GAME_TITLE, allTagged, provider2);
      expect(provider2.complete).not.toHaveBeenCalled();
    });
  });
});
