import { describe, it, expect, vi, beforeEach } from "vitest";
import type Database from "better-sqlite3";
import type { DrizzleDB } from "@/lib/db";
import {
  createTestDrizzleDB,
  seedTestUser,
  seedTestGame,
  seedTestTracks,
} from "../../test-helpers";
import { TEST_USER_ID } from "@/test/constants";

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

const { BackstageGames } = await import("../backstage-games");
const { Games } = await import("../games");
const { OnboardingPhase } = await import("@/types");

beforeEach(() => {
  ({ db, rawDb } = createTestDrizzleDB());
  seedTestUser(rawDb);
});

describe("BackstageGames", () => {
  describe("createDraft", () => {
    describe("when creating a draft game", () => {
      it("should create an unpublished game", async () => {
        const game = await BackstageGames.createDraft("Draft Game");
        expect(game.title).toBe("Draft Game");
        expect(game.published).toBe(false);
      });

      it("should NOT link the game to any library", async () => {
        const game = await BackstageGames.createDraft("Draft Game");
        const link = rawDb.prepare("SELECT * FROM library_games WHERE game_id = ?").get(game.id) as
          | Record<string, unknown>
          | undefined;
        expect(link).toBeUndefined();
      });
    });

    describe("when creating a draft with a Steam appid", () => {
      it("should set the thumbnail from the Steam appid", async () => {
        const game = await BackstageGames.createDraft("Steam Game", 504230);
        expect(game.thumbnail_url).toBe(
          "https://cdn.akamai.steamstatic.com/steam/apps/504230/header.jpg",
        );
      });
    });

    describe("when creating a draft without a Steam appid", () => {
      it("should leave thumbnail_url as null", async () => {
        const game = await BackstageGames.createDraft("No Steam");
        expect(game.thumbnail_url).toBeNull();
      });
    });
  });

  describe("setPhase", () => {
    describe("when setting a valid phase", () => {
      it("should update the onboarding_phase", async () => {
        const game = await BackstageGames.createDraft("Phase Game");
        await BackstageGames.setPhase(game.id, OnboardingPhase.Tagged);
        const updated = await Games.getById(game.id);
        expect(updated!.onboarding_phase).toBe("tagged");
      });
    });
  });

  describe("setPublished", () => {
    describe("when publishing a draft game", () => {
      it("should set published to true", async () => {
        const game = await BackstageGames.createDraft("Pub Game");
        await BackstageGames.setPublished(game.id, true);
        const updated = await Games.getById(game.id);
        expect(updated!.published).toBe(true);
      });
    });

    describe("when unpublishing a published game", () => {
      it("should set published to false", async () => {
        const game = await BackstageGames.createDraft("Pub Game");
        await BackstageGames.setPublished(game.id, true);
        await BackstageGames.setPublished(game.id, false);
        const updated = await Games.getById(game.id);
        expect(updated!.published).toBe(false);
      });
    });
  });

  describe("setPlaylistId", () => {
    describe("when setting a playlist ID", () => {
      it("should update the yt_playlist_id", async () => {
        const game = await BackstageGames.createDraft("PL Game");
        await BackstageGames.setPlaylistId(game.id, "PLtest123");
        const updated = await Games.getById(game.id);
        expect(updated!.yt_playlist_id).toBe("PLtest123");
      });
    });
  });

  describe("update", () => {
    describe("when updating with partial fields", () => {
      it("should update only the provided fields", async () => {
        const game = await BackstageGames.createDraft("Original Title");
        const updated = await BackstageGames.update(game.id, { title: "New Title" });
        expect(updated).not.toBeNull();
        expect(updated!.title).toBe("New Title");
      });

      it("should not change fields that were not provided", async () => {
        const game = await BackstageGames.createDraft("Keep Title", 12345);
        const updated = await BackstageGames.update(game.id, { tracklist_source: "discogs" });
        expect(updated!.title).toBe("Keep Title");
        expect(updated!.steam_appid).toBe(12345);
        expect(updated!.tracklist_source).toBe("discogs");
      });
    });

    describe("when updating a nonexistent game", () => {
      it("should return null", async () => {
        const result = await BackstageGames.update("nonexistent-id", { title: "Nope" });
        expect(result).toBeNull();
      });
    });

    describe("when updating needs_review", () => {
      it("should set the boolean flag correctly", async () => {
        const game = await BackstageGames.createDraft("Review Game");
        await BackstageGames.update(game.id, { needs_review: true });
        const updated = await Games.getById(game.id);
        expect(updated!.needs_review).toBe(true);
      });
    });

    describe("when updating steam_appid", () => {
      it("should set the steam_appid value", async () => {
        const game = await BackstageGames.createDraft("Steam Update");
        const updated = await BackstageGames.update(game.id, { steam_appid: 12345 });
        expect(updated).not.toBeNull();
        expect(updated!.steam_appid).toBe(12345);
      });

      it("should clear steam_appid when set to null", async () => {
        const game = await BackstageGames.createDraft("Steam Clear", 99999);
        expect(game.steam_appid).toBe(99999);

        const updated = await BackstageGames.update(game.id, { steam_appid: null });
        expect(updated).not.toBeNull();
        expect(updated!.steam_appid).toBeNull();
      });
    });

    describe("when updating yt_playlist_id", () => {
      it("should set the playlist ID", async () => {
        const game = await BackstageGames.createDraft("YT Game");
        const updated = await BackstageGames.update(game.id, {
          yt_playlist_id: "PLxxxxxxxx",
        });
        expect(updated!.yt_playlist_id).toBe("PLxxxxxxxx");
      });
    });

    describe("when updating thumbnail_url", () => {
      it("should set the thumbnail URL", async () => {
        const game = await BackstageGames.createDraft("Thumb Game");
        const updated = await BackstageGames.update(game.id, {
          thumbnail_url: "https://example.com/thumb.jpg",
        });
        expect(updated!.thumbnail_url).toBe("https://example.com/thumb.jpg");
      });
    });
  });

  describe("destroy", () => {
    describe("when the game is unpublished", () => {
      it("should delete the game", async () => {
        const game = await BackstageGames.createDraft("To Delete");
        await BackstageGames.destroy(game.id);
        expect(await Games.getById(game.id)).toBeNull();
      });

      it("should cascade-delete associated review flags", async () => {
        const game = await BackstageGames.createDraft("Flagged Game");
        rawDb
          .prepare("INSERT INTO game_review_flags (game_id, reason) VALUES (?, ?)")
          .run(game.id, "test-reason");
        await BackstageGames.destroy(game.id);
        const flags = rawDb
          .prepare("SELECT * FROM game_review_flags WHERE game_id = ?")
          .all(game.id);
        expect(flags).toHaveLength(0);
      });
    });

    describe("when the game is published", () => {
      it("should throw an error and not delete", async () => {
        const game = await BackstageGames.createDraft("Published Game");
        await BackstageGames.setPublished(game.id, true);
        await expect(BackstageGames.destroy(game.id)).rejects.toThrow(
          "cannot delete a published game",
        );
        expect(await Games.getById(game.id)).not.toBeNull();
      });
    });

    describe("when the game does not exist", () => {
      it("should not throw", async () => {
        await expect(BackstageGames.destroy("nonexistent")).resolves.not.toThrow();
      });
    });
  });

  describe("listPublished", () => {
    beforeEach(() => {
      seedTestGame(rawDb, TEST_USER_ID, { id: "pub-a", title: "Alpha Game", published: true });
      seedTestGame(rawDb, TEST_USER_ID, { id: "pub-b", title: "Beta Game", published: true });
      seedTestGame(rawDb, TEST_USER_ID, { id: "draft-c", title: "Draft Game", published: false });
    });

    describe("when listing without filters", () => {
      it("should return only published games", async () => {
        const games = await BackstageGames.listPublished();
        const ids = games.map((g) => g.id);
        expect(ids).toContain("pub-a");
        expect(ids).toContain("pub-b");
      });

      it("should NOT return unpublished games", async () => {
        const games = await BackstageGames.listPublished();
        const ids = games.map((g) => g.id);
        expect(ids).not.toContain("draft-c");
      });
    });

    describe("when searching by title", () => {
      it("should filter games by LIKE match", async () => {
        const games = await BackstageGames.listPublished("Alpha");
        expect(games).toHaveLength(1);
        expect(games[0].title).toBe("Alpha Game");
      });

      it("should return empty array when search matches nothing", async () => {
        const games = await BackstageGames.listPublished("Nonexistent");
        expect(games).toHaveLength(0);
      });
    });

    describe("when limit is specified", () => {
      it("should respect the limit", async () => {
        const games = await BackstageGames.listPublished(undefined, 1);
        expect(games).toHaveLength(1);
      });
    });
  });

  describe("listWithTrackStats", () => {
    describe("when games have tracks and review flags", () => {
      let gameId: string;

      beforeEach(() => {
        gameId = seedTestGame(rawDb, TEST_USER_ID, { id: "stats-game", title: "Stats Game" });
        // Seed 3 tagged tracks
        seedTestTracks(rawDb, gameId, 3, true);
        // Seed 2 untagged tracks with distinct names (avoid PK collision)
        for (let i = 0; i < 2; i++) {
          rawDb
            .prepare(`INSERT INTO tracks (game_id, name, position) VALUES (?, ?, ?)`)
            .run(gameId, `Untagged Track ${i + 1}`, 10 + i);
        }
        // Add a review flag
        rawDb
          .prepare("INSERT INTO game_review_flags (game_id, reason) VALUES (?, ?)")
          .run(gameId, "bad-data");
      });

      it("should return correct track_count", async () => {
        const games = await BackstageGames.listWithTrackStats();
        const game = games.find((g) => g.id === gameId);
        expect(game).toBeDefined();
        expect(game!.trackCount).toBe(5);
      });

      it("should return correct tagged_count", async () => {
        const games = await BackstageGames.listWithTrackStats();
        const game = games.find((g) => g.id === gameId);
        expect(game!.taggedCount).toBe(3);
      });

      it("should return correct active_count", async () => {
        const games = await BackstageGames.listWithTrackStats();
        const game = games.find((g) => g.id === gameId);
        // All tracks default to active=1
        expect(game!.activeCount).toBe(5);
      });

      it("should return correct review_flag_count", async () => {
        const games = await BackstageGames.listWithTrackStats();
        const game = games.find((g) => g.id === gameId);
        expect(game!.reviewFlagCount).toBe(1);
      });
    });

    describe("when a game has no tracks", () => {
      beforeEach(() => {
        seedTestGame(rawDb, TEST_USER_ID, { id: "empty-game", title: "Empty Game" });
      });

      it("should return zero counts", async () => {
        const games = await BackstageGames.listWithTrackStats();
        const game = games.find((g) => g.id === "empty-game");
        expect(game).toBeDefined();
        expect(game!.trackCount).toBe(0);
        expect(game!.taggedCount).toBe(0);
        expect(game!.activeCount).toBe(0);
        expect(game!.reviewFlagCount).toBe(0);
      });
    });
  });

  describe("searchWithStats", () => {
    beforeEach(() => {
      seedTestGame(rawDb, TEST_USER_ID, {
        id: "s1",
        title: "Celeste",
        published: true,
        onboardingPhase: "tagged",
      });
      seedTestGame(rawDb, TEST_USER_ID, {
        id: "s2",
        title: "Hollow Knight",
        published: false,
        onboardingPhase: "draft",
      });
      // Set needs_review on s2
      rawDb.prepare("UPDATE games SET needs_review = 1 WHERE id = ?").run("s2");
    });

    describe("when filtering by title", () => {
      it("should return matching games", async () => {
        const results = await BackstageGames.searchWithStats({ title: "Celeste" });
        expect(results).toHaveLength(1);
        expect(results[0].id).toBe("s1");
      });
    });

    describe("when filtering by phase", () => {
      it("should return games in the specified phase", async () => {
        const results = await BackstageGames.searchWithStats({ phase: "draft" });
        expect(results).toHaveLength(1);
        expect(results[0].id).toBe("s2");
      });
    });

    describe("when filtering by needsReview", () => {
      it("should return only flagged games", async () => {
        const results = await BackstageGames.searchWithStats({ needsReview: true });
        expect(results).toHaveLength(1);
        expect(results[0].id).toBe("s2");
      });

      it("should return only non-flagged games when false", async () => {
        const results = await BackstageGames.searchWithStats({ needsReview: false });
        expect(results).toHaveLength(1);
        expect(results[0].id).toBe("s1");
      });
    });

    describe("when filtering by published", () => {
      it("should return only published games", async () => {
        const results = await BackstageGames.searchWithStats({ published: true });
        expect(results).toHaveLength(1);
        expect(results[0].id).toBe("s1");
      });
    });

    describe("when no filters are provided", () => {
      it("should return all games", async () => {
        const results = await BackstageGames.searchWithStats({});
        expect(results).toHaveLength(2);
      });
    });
  });

  describe("dashboardCounts", () => {
    describe("when games exist in different phases", () => {
      beforeEach(() => {
        seedTestGame(rawDb, TEST_USER_ID, {
          id: "d1",
          title: "Draft 1",
          onboardingPhase: "draft",
          published: false,
        });
        seedTestGame(rawDb, TEST_USER_ID, {
          id: "d2",
          title: "Draft 2",
          onboardingPhase: "draft",
          published: false,
        });
        seedTestGame(rawDb, TEST_USER_ID, {
          id: "t1",
          title: "Tagged 1",
          onboardingPhase: "tagged",
          published: true,
        });
        // Set needs_review on one draft
        rawDb.prepare("UPDATE games SET needs_review = 1 WHERE id = ?").run("d1");
      });

      it("should return counts grouped by phase", async () => {
        const counts = await BackstageGames.dashboardCounts();
        const draft = counts.find((c) => c.phase === "draft");
        const tagged = counts.find((c) => c.phase === "tagged");
        expect(draft).toBeDefined();
        expect(draft!.count).toBe(2);
        expect(tagged).toBeDefined();
        expect(tagged!.count).toBe(1);
      });

      it("should include published counts per phase", async () => {
        const counts = await BackstageGames.dashboardCounts();
        const draft = counts.find((c) => c.phase === "draft");
        const tagged = counts.find((c) => c.phase === "tagged");
        expect(draft!.publishedCount).toBe(0);
        expect(tagged!.publishedCount).toBe(1);
      });

      it("should include needs_review counts per phase", async () => {
        const counts = await BackstageGames.dashboardCounts();
        const draft = counts.find((c) => c.phase === "draft");
        expect(draft!.needsReviewCount).toBe(1);
      });
    });

    describe("when there are no games", () => {
      it("should return an empty array", async () => {
        const counts = await BackstageGames.dashboardCounts();
        expect(counts).toEqual([]);
      });
    });
  });
});
