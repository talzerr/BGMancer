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

const { Tracks } = await import("../tracks");

let userId: string;
let gameId: string;

beforeEach(() => {
  ({ db, rawDb } = createTestDrizzleDB());
  ({ userId } = seedTestUser(rawDb));
  gameId = seedTestGame(rawDb, userId);
});

describe("Tracks", () => {
  describe("upsertBatch", () => {
    describe("when inserting new tracks", () => {
      it("should insert all tracks", async () => {
        await Tracks.upsertBatch([
          { gameId, name: "Title Screen", position: 0 },
          { gameId, name: "Battle Theme", position: 1, durationSeconds: 210 },
        ]);

        const rows = rawDb
          .prepare("SELECT * FROM tracks WHERE game_id = ? ORDER BY position")
          .all(gameId) as Array<Record<string, unknown>>;
        expect(rows).toHaveLength(2);
        expect(rows[0].name).toBe("Title Screen");
        expect(rows[1].duration_seconds).toBe(210);
      });
    });

    describe("when a track with the same (game_id, name) already exists", () => {
      it("should update position and duration on conflict", async () => {
        await Tracks.upsertBatch([
          { gameId, name: "Main Theme", position: 0, durationSeconds: 120 },
        ]);
        await Tracks.upsertBatch([
          { gameId, name: "Main Theme", position: 5, durationSeconds: 180 },
        ]);

        const rows = rawDb
          .prepare("SELECT * FROM tracks WHERE game_id = ? AND name = ?")
          .all(gameId, "Main Theme") as Array<Record<string, unknown>>;
        expect(rows).toHaveLength(1);
        expect(rows[0].position).toBe(5);
        expect(rows[0].duration_seconds).toBe(180);
      });

      it("should preserve existing duration when new value is null (COALESCE)", async () => {
        await Tracks.upsertBatch([{ gameId, name: "Theme", position: 0, durationSeconds: 120 }]);
        await Tracks.upsertBatch([{ gameId, name: "Theme", position: 1 }]);

        const row = rawDb
          .prepare("SELECT duration_seconds FROM tracks WHERE game_id = ? AND name = ?")
          .get(gameId, "Theme") as { duration_seconds: number | null };
        expect(row.duration_seconds).toBe(120);
      });
    });
  });

  describe("getByGame", () => {
    describe("when tracks exist", () => {
      it("should return tracks ordered by position", async () => {
        await Tracks.upsertBatch([
          { gameId, name: "Z Track", position: 2 },
          { gameId, name: "A Track", position: 0 },
          { gameId, name: "M Track", position: 1 },
        ]);

        const tracks = await Tracks.getByGame(gameId);
        expect(tracks).toHaveLength(3);
        expect(tracks[0].name).toBe("A Track");
        expect(tracks[1].name).toBe("M Track");
        expect(tracks[2].name).toBe("Z Track");
      });
    });

    describe("when no tracks exist", () => {
      it("should return an empty array", async () => {
        expect(await Tracks.getByGame(gameId)).toEqual([]);
      });
    });

    describe("when tracks have malformed JSON in tag columns", () => {
      it("should return empty arrays for roles/moods/instrumentation", async () => {
        rawDb
          .prepare(
            "INSERT INTO tracks (game_id, name, position, roles, moods, instrumentation) VALUES (?, ?, ?, ?, ?, ?)",
          )
          .run(gameId, "Bad JSON Track", 0, "{not json", "also bad", "nope");

        const tracks = await Tracks.getByGame(gameId);
        expect(tracks).toHaveLength(1);
        expect(tracks[0].roles).toEqual([]);
        expect(tracks[0].moods).toEqual([]);
        expect(tracks[0].instrumentation).toEqual([]);
      });
    });
  });

  describe("hasData", () => {
    describe("when tracks exist for the game", () => {
      it("should return true", async () => {
        seedTestTracks(rawDb, gameId, 1);
        expect(await Tracks.hasData(gameId)).toBe(true);
      });
    });

    describe("when no tracks exist for the game", () => {
      it("should return false", async () => {
        expect(await Tracks.hasData(gameId)).toBe(false);
      });
    });
  });

  describe("isTagged", () => {
    describe("when at least one track has tagged_at set", () => {
      it("should return true", async () => {
        seedTestTracks(rawDb, gameId, 2, true);
        expect(await Tracks.isTagged(gameId)).toBe(true);
      });
    });

    describe("when no tracks have tagged_at", () => {
      it("should return false", async () => {
        seedTestTracks(rawDb, gameId, 2, false);
        expect(await Tracks.isTagged(gameId)).toBe(false);
      });
    });

    describe("when no tracks exist", () => {
      it("should return false", async () => {
        expect(await Tracks.isTagged(gameId)).toBe(false);
      });
    });
  });

  describe("updateTags", () => {
    describe("when tagging a track", () => {
      it("should set all tag fields and tagged_at", async () => {
        seedTestTracks(rawDb, gameId, 1);
        await Tracks.updateTags(gameId, "Track 1", {
          energy: 3,
          roles: '["combat","build"]',
          moods: '["epic","tense"]',
          instrumentation: '["orchestral"]',
          hasVocals: false,
        });

        const track = (await Tracks.getByGame(gameId))[0];
        expect(track.energy).toBe(3);
        expect(track.roles).toEqual(["combat", "build"]);
        expect(track.moods).toEqual(["epic", "tense"]);
        expect(track.instrumentation).toEqual(["orchestral"]);
        expect(track.hasVocals).toBe(false);
        expect(track.taggedAt).not.toBeNull();
      });
    });

    describe("when track has discovered = 'approved'", () => {
      it("should set active to 1", async () => {
        await Tracks.insertDiscovered(gameId, "Bonus Track");
        await Tracks.approveDiscovered(gameId, ["Bonus Track"]);

        // Verify it is inactive before tagging
        const before = (await Tracks.getByGame(gameId)).find((t) => t.name === "Bonus Track");
        expect(before!.active).toBe(false);

        await Tracks.updateTags(gameId, "Bonus Track", {
          energy: 1,
          roles: '["ambient"]',
          moods: '["peaceful"]',
          instrumentation: '["piano"]',
          hasVocals: false,
        });

        const after = (await Tracks.getByGame(gameId)).find((t) => t.name === "Bonus Track");
        expect(after!.active).toBe(true);
      });
    });
  });

  describe("insertDiscovered", () => {
    describe("when inserting a discovered track", () => {
      it("should create an inactive track with discovered = 'pending'", async () => {
        await Tracks.insertDiscovered(gameId, "Hidden Track");

        const track = (await Tracks.getByGame(gameId)).find((t) => t.name === "Hidden Track");
        expect(track).toBeDefined();
        expect(track!.active).toBe(false);
        expect(track!.discovered).toBe("pending");
      });

      it("should not duplicate on repeated calls", async () => {
        await Tracks.insertDiscovered(gameId, "Same Track");
        await Tracks.insertDiscovered(gameId, "Same Track");

        const matches = (await Tracks.getByGame(gameId)).filter((t) => t.name === "Same Track");
        expect(matches).toHaveLength(1);
      });

      it("should auto-assign position after existing tracks", async () => {
        seedTestTracks(rawDb, gameId, 3);
        await Tracks.insertDiscovered(gameId, "New Discovery");

        const track = (await Tracks.getByGame(gameId)).find((t) => t.name === "New Discovery");
        expect(track!.position).toBe(3); // 0-indexed max was 2, so next is 3
      });
    });
  });

  describe("approveDiscovered", () => {
    describe("when approving pending discovered tracks", () => {
      it("should change discovered from 'pending' to 'approved'", async () => {
        await Tracks.insertDiscovered(gameId, "Track A");
        await Tracks.insertDiscovered(gameId, "Track B");

        await Tracks.approveDiscovered(gameId, ["Track A", "Track B"]);

        const tracks = await Tracks.getByGame(gameId);
        expect(tracks.find((t) => t.name === "Track A")!.discovered).toBe("approved");
        expect(tracks.find((t) => t.name === "Track B")!.discovered).toBe("approved");
      });
    });

    describe("when names array is empty", () => {
      it("should not throw", async () => {
        await expect(Tracks.approveDiscovered(gameId, [])).resolves.not.toThrow();
      });
    });
  });

  describe("rejectDiscovered", () => {
    describe("when rejecting discovered tracks", () => {
      it("should set discovered to 'rejected' and active to 0", async () => {
        await Tracks.insertDiscovered(gameId, "Bad Track");
        await Tracks.rejectDiscovered(gameId, ["Bad Track"]);

        const track = (await Tracks.getByGame(gameId)).find((t) => t.name === "Bad Track");
        expect(track!.discovered).toBe("rejected");
        expect(track!.active).toBe(false);
      });
    });

    describe("when names array is empty", () => {
      it("should not throw", async () => {
        await expect(Tracks.rejectDiscovered(gameId, [])).resolves.not.toThrow();
      });
    });
  });

  describe("clearTags", () => {
    describe("when clearing tags for a game", () => {
      it("should reset energy, roles, moods, instrumentation, has_vocals, and tagged_at to null", async () => {
        seedTestTracks(rawDb, gameId, 2, true);

        await Tracks.clearTags(gameId);

        const tracks = await Tracks.getByGame(gameId);
        for (const track of tracks) {
          expect(track.energy).toBeNull();
          expect(track.roles).toEqual([]);
          expect(track.moods).toEqual([]);
          expect(track.instrumentation).toEqual([]);
          expect(track.hasVocals).toBeNull();
          expect(track.taggedAt).toBeNull();
        }
      });

      it("should not affect tracks from other games", async () => {
        const otherGame = seedTestGame(rawDb, userId, { id: "other-game", title: "Other" });
        seedTestTracks(rawDb, otherGame, 1, true);
        seedTestTracks(rawDb, gameId, 1, true);

        await Tracks.clearTags(gameId);

        const otherTracks = await Tracks.getByGame(otherGame);
        expect(otherTracks[0].energy).not.toBeNull();
        expect(otherTracks[0].taggedAt).not.toBeNull();
      });
    });
  });

  describe("updateFields", () => {
    beforeEach(() => {
      seedTestTracks(rawDb, gameId, 1);
    });

    describe("when updating a single non-tag field", () => {
      it("should update active without setting tagged_at", async () => {
        await Tracks.updateFields(gameId, "Track 1", { active: false });

        const track = (await Tracks.getByGame(gameId))[0];
        expect(track.active).toBe(false);
        expect(track.taggedAt).toBeNull();
      });
    });

    describe("when updating a tag field", () => {
      it("should auto-stamp tagged_at", async () => {
        await Tracks.updateFields(gameId, "Track 1", { energy: 2 });

        const track = (await Tracks.getByGame(gameId))[0];
        expect(track.energy).toBe(2);
        expect(track.taggedAt).not.toBeNull();
      });
    });

    describe("when renaming a track", () => {
      it("should change the track name", async () => {
        await Tracks.updateFields(gameId, "Track 1", { newName: "Renamed Track" });

        const tracks = await Tracks.getByGame(gameId);
        expect(tracks[0].name).toBe("Renamed Track");
      });
    });

    describe("when no fields are provided", () => {
      it("should not throw or modify anything", async () => {
        const before = (await Tracks.getByGame(gameId))[0];
        await Tracks.updateFields(gameId, "Track 1", {});
        const after = (await Tracks.getByGame(gameId))[0];
        expect(after).toEqual(before);
      });
    });

    describe("when setting tag fields to null", () => {
      it("should clear the field value and still stamp tagged_at", async () => {
        // First set a value
        await Tracks.updateFields(gameId, "Track 1", { energy: 3 });
        // Then clear it
        await Tracks.updateFields(gameId, "Track 1", { energy: null });

        const track = (await Tracks.getByGame(gameId))[0];
        expect(track.energy).toBeNull();
        expect(track.taggedAt).not.toBeNull();
      });
    });

    describe("when updating roles", () => {
      it("should set the roles JSON string", async () => {
        await Tracks.updateFields(gameId, "Track 1", { roles: '["combat"]' });

        const track = (await Tracks.getByGame(gameId))[0];
        expect(track.roles).toEqual(["combat"]);
        expect(track.taggedAt).not.toBeNull();
      });
    });

    describe("when updating moods", () => {
      it("should set the moods JSON string", async () => {
        await Tracks.updateFields(gameId, "Track 1", { moods: '["epic"]' });

        const track = (await Tracks.getByGame(gameId))[0];
        expect(track.moods).toEqual(["epic"]);
        expect(track.taggedAt).not.toBeNull();
      });
    });

    describe("when updating instrumentation", () => {
      it("should set the instrumentation JSON string", async () => {
        await Tracks.updateFields(gameId, "Track 1", { instrumentation: '["piano"]' });

        const track = (await Tracks.getByGame(gameId))[0];
        expect(track.instrumentation).toEqual(["piano"]);
        expect(track.taggedAt).not.toBeNull();
      });
    });

    describe("when updating hasVocals", () => {
      it("should set has_vocals to true", async () => {
        await Tracks.updateFields(gameId, "Track 1", { hasVocals: true });

        const track = (await Tracks.getByGame(gameId))[0];
        expect(track.hasVocals).toBe(true);
        expect(track.taggedAt).not.toBeNull();
      });

      it("should set has_vocals to false", async () => {
        await Tracks.updateFields(gameId, "Track 1", { hasVocals: false });

        const track = (await Tracks.getByGame(gameId))[0];
        expect(track.hasVocals).toBe(false);
        expect(track.taggedAt).not.toBeNull();
      });

      it("should set has_vocals to null", async () => {
        await Tracks.updateFields(gameId, "Track 1", { hasVocals: true });
        await Tracks.updateFields(gameId, "Track 1", { hasVocals: null });

        const track = (await Tracks.getByGame(gameId))[0];
        expect(track.hasVocals).toBeNull();
        expect(track.taggedAt).not.toBeNull();
      });
    });
  });

  describe("deleteByKeys", () => {
    describe("when deleting specific tracks", () => {
      it("should remove only the specified tracks", async () => {
        seedTestTracks(rawDb, gameId, 3);

        await Tracks.deleteByKeys([
          { gameId, name: "Track 1" },
          { gameId, name: "Track 3" },
        ]);

        const remaining = await Tracks.getByGame(gameId);
        expect(remaining).toHaveLength(1);
        expect(remaining[0].name).toBe("Track 2");
      });
    });

    describe("when keys array is empty", () => {
      it("should not throw or delete anything", async () => {
        seedTestTracks(rawDb, gameId, 2);
        await Tracks.deleteByKeys([]);
        expect(await Tracks.getByGame(gameId)).toHaveLength(2);
      });
    });

    describe("when tracks have associated video_tracks", () => {
      it("should also delete the video_tracks rows", async () => {
        seedTestTracks(rawDb, gameId, 1);
        rawDb
          .prepare("INSERT INTO video_tracks (video_id, game_id, track_name) VALUES (?, ?, ?)")
          .run("vid-1", gameId, "Track 1");

        await Tracks.deleteByKeys([{ gameId, name: "Track 1" }]);

        const videoTracks = rawDb
          .prepare("SELECT * FROM video_tracks WHERE game_id = ? AND track_name = ?")
          .all(gameId, "Track 1");
        expect(videoTracks).toHaveLength(0);
      });
    });
  });

  describe("deleteByGame", () => {
    describe("when deleting all tracks for a game", () => {
      it("should remove all tracks", async () => {
        seedTestTracks(rawDb, gameId, 5);
        await Tracks.deleteByGame(gameId);
        expect(await Tracks.getByGame(gameId)).toHaveLength(0);
      });

      it("should not affect other games", async () => {
        const otherGame = seedTestGame(rawDb, userId, { id: "other-game-2", title: "Other" });
        seedTestTracks(rawDb, gameId, 3);
        seedTestTracks(rawDb, otherGame, 2);

        await Tracks.deleteByGame(gameId);

        expect(await Tracks.getByGame(gameId)).toHaveLength(0);
        expect(await Tracks.getByGame(otherGame)).toHaveLength(2);
      });
    });
  });

  describe("listAllWithVideoIds", () => {
    describe("when tracks exist with video_tracks joined", () => {
      it("should return tracks with gameTitle and videoId", async () => {
        seedTestTracks(rawDb, gameId, 1);
        rawDb
          .prepare(
            "INSERT INTO video_tracks (video_id, game_id, track_name, duration_seconds, view_count) VALUES (?, ?, ?, ?, ?)",
          )
          .run("vid-all-1", gameId, "Track 1", 200, 50000);

        const rows = await Tracks.listAllWithVideoIds();
        expect(rows).toHaveLength(1);
        expect(rows[0].gameTitle).toBe("Test Game");
        expect(rows[0].videoId).toBe("vid-all-1");
        expect(rows[0].durationSeconds).toBe(200);
        expect(rows[0].viewCount).toBe(50000);
      });
    });

    describe("when tracks have no video_tracks", () => {
      it("should return null for videoId, durationSeconds, and viewCount", async () => {
        seedTestTracks(rawDb, gameId, 1);

        const rows = await Tracks.listAllWithVideoIds();
        expect(rows).toHaveLength(1);
        expect(rows[0].videoId).toBeNull();
        expect(rows[0].durationSeconds).toBeNull();
        expect(rows[0].viewCount).toBeNull();
      });
    });
  });

  describe("searchWithVideoIds", () => {
    beforeEach(() => {
      seedTestTracks(rawDb, gameId, 3, true);
    });

    describe("when filtering by gameId", () => {
      it("should return only tracks for that game", async () => {
        const otherGame = seedTestGame(rawDb, userId, {
          id: "other-search",
          title: "Other Search",
        });
        seedTestTracks(rawDb, otherGame, 2);

        const results = await Tracks.searchWithVideoIds({ gameId });
        expect(results).toHaveLength(3);
        expect(results.every((r) => r.gameId === gameId)).toBe(true);
      });
    });

    describe("when filtering by game title", () => {
      it("should perform a LIKE search", async () => {
        const results = await Tracks.searchWithVideoIds({ gameTitle: "Test" });
        expect(results).toHaveLength(3);
      });

      it("should not match non-matching titles", async () => {
        const results = await Tracks.searchWithVideoIds({ gameTitle: "Nonexistent" });
        expect(results).toHaveLength(0);
      });
    });

    describe("when filtering by untaggedOnly", () => {
      it("should return only untagged tracks", async () => {
        // All 3 tracks are tagged from seedTestTracks. Add one untagged.
        await Tracks.upsertBatch([{ gameId, name: "Untagged Track", position: 10 }]);

        const results = await Tracks.searchWithVideoIds({ untaggedOnly: true });
        expect(results).toHaveLength(1);
        expect(results[0].name).toBe("Untagged Track");
      });
    });

    describe("when filtering by track name", () => {
      it("should perform a LIKE search on track name", async () => {
        const results = await Tracks.searchWithVideoIds({ name: "Track 1" });
        expect(results).toHaveLength(1);
        expect(results[0].name).toBe("Track 1");
      });

      it("should return partial matches", async () => {
        const results = await Tracks.searchWithVideoIds({ name: "Track" });
        expect(results).toHaveLength(3);
      });
    });

    describe("when filtering by energy", () => {
      it("should return only tracks with matching energy", async () => {
        const results = await Tracks.searchWithVideoIds({ energy: 2 });
        expect(results.every((r) => r.energy === 2)).toBe(true);
      });
    });

    describe("when filtering by active", () => {
      it("should return only active tracks when true", async () => {
        // Deactivate one track
        await Tracks.updateFields(gameId, "Track 1", { active: false });

        const results = await Tracks.searchWithVideoIds({ active: true });
        expect(results).toHaveLength(2);
        expect(results.every((r) => r.active)).toBe(true);
      });

      it("should return only inactive tracks when false", async () => {
        await Tracks.updateFields(gameId, "Track 1", { active: false });

        const results = await Tracks.searchWithVideoIds({ active: false });
        expect(results).toHaveLength(1);
        expect(results[0].name).toBe("Track 1");
      });
    });

    describe("when no filters are provided", () => {
      it("should return all tracks", async () => {
        const results = await Tracks.searchWithVideoIds({});
        expect(results).toHaveLength(3);
      });
    });
  });
});
