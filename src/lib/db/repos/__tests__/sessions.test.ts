import { describe, it, expect, vi, beforeEach } from "vitest";
import type Database from "better-sqlite3";
import { createTestDrizzleDB, seedTestUser, seedTestSession } from "../../test-helpers";
import { TEST_USER_ID } from "@/test/constants";
import { ArcPhase, PlaylistMode, TrackInstrumentation, TrackMood, TrackRole } from "@/types";
import type { DrizzleDB } from "@/lib/db";

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

const { Sessions } = await import("../sessions");

beforeEach(() => {
  const testDb = createTestDrizzleDB();
  db = testDb.db;
  rawDb = testDb.rawDb;
  seedTestUser(rawDb);
});

describe("Sessions", () => {
  describe("create", () => {
    describe("when creating a new session", () => {
      it("should return a PlaylistSession with the given name", async () => {
        const session = await Sessions.create(TEST_USER_ID, "My Session", PlaylistMode.Journey);
        expect(session.name).toBe("My Session");
        expect(session.user_id).toBe(TEST_USER_ID);
        expect(session.is_archived).toBe(false);
        expect(session.playlist_mode).toBe(PlaylistMode.Journey);
        expect(session.id).toBeTruthy();
      });

      it("should store the description when provided", async () => {
        const session = await Sessions.create(
          TEST_USER_ID,
          "S1",
          PlaylistMode.Journey,
          "A description",
        );
        expect(session.description).toBe("A description");
      });

      it("should set description to null when not provided", async () => {
        const session = await Sessions.create(TEST_USER_ID, "S1", PlaylistMode.Journey);
        expect(session.description).toBeNull();
      });

      it("should persist the provided playlist mode", async () => {
        const session = await Sessions.create(TEST_USER_ID, "Chill Run", PlaylistMode.Chill);
        expect(session.playlist_mode).toBe(PlaylistMode.Chill);
      });
    });

    describe("when FIFO limit is reached", () => {
      it("should evict the oldest session when creating a 4th", async () => {
        const s1 = await Sessions.create(TEST_USER_ID, "Session 1", PlaylistMode.Journey);
        await Sessions.create(TEST_USER_ID, "Session 2", PlaylistMode.Journey);
        await Sessions.create(TEST_USER_ID, "Session 3", PlaylistMode.Journey);
        await Sessions.create(TEST_USER_ID, "Session 4", PlaylistMode.Journey);

        const remaining = rawDb
          .prepare("SELECT id FROM playlists WHERE user_id = ? ORDER BY created_at ASC")
          .all(TEST_USER_ID) as Array<{ id: string }>;
        expect(remaining).toHaveLength(3);
        expect(remaining.map((r) => r.id)).not.toContain(s1.id);
      });

      it("should not evict sessions belonging to other users", async () => {
        seedTestUser(rawDb, "other-user");
        const otherSession = await Sessions.create("other-user", "Other", PlaylistMode.Journey);

        await Sessions.create(TEST_USER_ID, "S1", PlaylistMode.Journey);
        await Sessions.create(TEST_USER_ID, "S2", PlaylistMode.Journey);
        await Sessions.create(TEST_USER_ID, "S3", PlaylistMode.Journey);
        await Sessions.create(TEST_USER_ID, "S4", PlaylistMode.Journey);

        const otherStillExists = await Sessions.getById(otherSession.id);
        expect(otherStillExists).not.toBeNull();
      });
    });
  });

  describe("getActive", () => {
    describe("when non-archived sessions exist", () => {
      it("should return the most recent non-archived session", async () => {
        const oldId = seedTestSession(rawDb, TEST_USER_ID, { id: "old-session", name: "Old" });
        rawDb
          .prepare("UPDATE playlists SET created_at = '2024-01-01T00:00:00Z' WHERE id = ?")
          .run(oldId);
        const newerId = seedTestSession(rawDb, TEST_USER_ID, {
          id: "newer-session",
          name: "Newer",
        });
        rawDb
          .prepare("UPDATE playlists SET created_at = '2024-01-02T00:00:00Z' WHERE id = ?")
          .run(newerId);

        const active = await Sessions.getActive(TEST_USER_ID);
        expect(active).not.toBeNull();
        expect(active!.id).toBe(newerId);
      });
    });

    describe("when all sessions are archived", () => {
      it("should return null", async () => {
        const id = seedTestSession(rawDb, TEST_USER_ID, { isArchived: true });
        expect(id).toBeTruthy();

        const active = await Sessions.getActive(TEST_USER_ID);
        expect(active).toBeNull();
      });
    });

    describe("when no sessions exist", () => {
      it("should return null", async () => {
        expect(await Sessions.getActive(TEST_USER_ID)).toBeNull();
      });
    });
  });

  describe("getById", () => {
    describe("when session exists", () => {
      it("should return the session", async () => {
        const created = await Sessions.create(TEST_USER_ID, "Test", PlaylistMode.Journey);
        const found = await Sessions.getById(created.id);
        expect(found).not.toBeNull();
        expect(found!.name).toBe("Test");
      });

      it("should sanitize an unknown playlist_mode column value to Journey", async () => {
        const created = await Sessions.create(TEST_USER_ID, "Test", PlaylistMode.Chill);
        // Simulate corruption / forwards-incompat: write a value the enum doesn't know.
        rawDb
          .prepare("UPDATE playlists SET playlist_mode = ? WHERE id = ?")
          .run("bogus", created.id);

        const found = await Sessions.getById(created.id);
        expect(found!.playlist_mode).toBe(PlaylistMode.Journey);
      });
    });

    describe("when session does not exist", () => {
      it("should return null", async () => {
        expect(await Sessions.getById("nonexistent")).toBeNull();
      });
    });
  });

  describe("listAllWithCounts", () => {
    describe("when sessions have tracks", () => {
      it("should include track_count for each session", async () => {
        const session = await Sessions.create(TEST_USER_ID, "With tracks", PlaylistMode.Journey);

        // Insert some playlist tracks directly
        const gameId = "game-1";
        rawDb.prepare("INSERT INTO games (id, title) VALUES (?, ?)").run(gameId, "Test Game");
        for (let i = 0; i < 3; i++) {
          rawDb
            .prepare(
              "INSERT INTO playlist_tracks (id, playlist_id, game_id, position) VALUES (?, ?, ?, ?)",
            )
            .run(`track-${i}`, session.id, gameId, i);
        }

        const list = await Sessions.listAllWithCounts(TEST_USER_ID);
        expect(list).toHaveLength(1);
        expect(list[0].track_count).toBe(3);
      });

      it("should return newest first", async () => {
        await Sessions.create(TEST_USER_ID, "First", PlaylistMode.Journey);
        await Sessions.create(TEST_USER_ID, "Second", PlaylistMode.Journey);

        const list = await Sessions.listAllWithCounts(TEST_USER_ID);
        expect(list[0].name).toBe("Second");
        expect(list[1].name).toBe("First");
      });
    });

    describe("when user has no sessions", () => {
      it("should return an empty array", async () => {
        const list = await Sessions.listAllWithCounts(TEST_USER_ID);
        expect(list).toEqual([]);
      });
    });

    describe("when sessions have no tracks", () => {
      it("should return track_count of 0", async () => {
        await Sessions.create(TEST_USER_ID, "Empty", PlaylistMode.Journey);
        const list = await Sessions.listAllWithCounts(TEST_USER_ID);
        expect(list[0].track_count).toBe(0);
      });
    });
  });

  describe("rename", () => {
    describe("when renaming a session", () => {
      it("should update the session name", async () => {
        const session = await Sessions.create(TEST_USER_ID, "Original", PlaylistMode.Journey);
        await Sessions.rename(session.id, "Renamed");

        const updated = await Sessions.getById(session.id);
        expect(updated!.name).toBe("Renamed");
      });
    });
  });

  describe("updateTelemetry + getByIdWithTelemetry", () => {
    describe("when storing rubric and game budgets", () => {
      it("should roundtrip JSON data correctly", async () => {
        const session = await Sessions.create(TEST_USER_ID, "Telemetry", PlaylistMode.Journey);
        const rubric = {
          phases: {
            [ArcPhase.Rising]: {
              preferredMoods: [TrackMood.Peaceful],
              preferredInstrumentation: [TrackInstrumentation.Piano],
              preferredRoles: [TrackRole.Ambient],
            },
          },
          penalizedMoods: [] as TrackMood[],
          allowVocals: false,
        };
        const budgets = { "game-a": 10, "game-b": 5 };

        await Sessions.updateTelemetry(session.id, rubric, budgets);
        const result = await Sessions.getByIdWithTelemetry(session.id);

        expect(result).not.toBeNull();
        expect(result!.rubric).toEqual(rubric);
        expect(result!.gameBudgets).toEqual(budgets);
      });
    });

    describe("when rubric and gameBudgets are undefined", () => {
      it("should store null for both fields", async () => {
        const session = await Sessions.create(
          TEST_USER_ID,
          "Undefined telemetry",
          PlaylistMode.Journey,
        );
        await Sessions.updateTelemetry(session.id);

        const result = await Sessions.getByIdWithTelemetry(session.id);
        expect(result).not.toBeNull();
        expect(result!.rubric).toBeNull();
        expect(result!.gameBudgets).toBeNull();
      });
    });

    describe("when telemetry is not set", () => {
      it("should return null for rubric and gameBudgets", async () => {
        const session = await Sessions.create(TEST_USER_ID, "No telemetry", PlaylistMode.Journey);
        const result = await Sessions.getByIdWithTelemetry(session.id);

        expect(result!.rubric).toBeNull();
        expect(result!.gameBudgets).toBeNull();
      });
    });

    describe("when JSON is malformed in the database", () => {
      it("should return null for the malformed field", async () => {
        const session = await Sessions.create(TEST_USER_ID, "Bad JSON", PlaylistMode.Journey);
        rawDb
          .prepare("UPDATE playlists SET rubric = ?, game_budgets = ? WHERE id = ?")
          .run("{not valid json", '{"a":1}', session.id);

        const result = await Sessions.getByIdWithTelemetry(session.id);
        expect(result!.rubric).toBeNull();
        expect(result!.gameBudgets).toEqual({ a: 1 });
      });

      it("should return null for gameBudgets when game_budgets JSON is malformed", async () => {
        const session = await Sessions.create(TEST_USER_ID, "Bad Budgets", PlaylistMode.Journey);
        rawDb
          .prepare("UPDATE playlists SET rubric = ?, game_budgets = ? WHERE id = ?")
          .run('{"targetEnergy":[2]}', "not valid json!!!", session.id);

        const result = await Sessions.getByIdWithTelemetry(session.id);
        expect(result).not.toBeNull();
        expect(result!.gameBudgets).toBeNull();
      });
    });

    describe("when session does not exist", () => {
      it("should return null", async () => {
        expect(await Sessions.getByIdWithTelemetry("nonexistent")).toBeNull();
      });
    });
  });

  describe("listRecent", () => {
    describe("when sessions exist across users", () => {
      it("should return sessions from all users newest first", async () => {
        seedTestUser(rawDb, "user-2");
        const idA = seedTestSession(rawDb, TEST_USER_ID, { id: "recent-a", name: "A" });
        rawDb
          .prepare("UPDATE playlists SET created_at = '2024-01-01T00:00:00Z' WHERE id = ?")
          .run(idA);
        const idB = seedTestSession(rawDb, "user-2", { id: "recent-b", name: "B" });
        rawDb
          .prepare("UPDATE playlists SET created_at = '2024-01-02T00:00:00Z' WHERE id = ?")
          .run(idB);

        const recent = await Sessions.listRecent(10);
        expect(recent).toHaveLength(2);
        expect(recent[0].name).toBe("B");
        expect(recent[1].name).toBe("A");
      });

      it("should respect the limit parameter", async () => {
        await Sessions.create(TEST_USER_ID, "A", PlaylistMode.Journey);
        await Sessions.create(TEST_USER_ID, "B", PlaylistMode.Journey);
        await Sessions.create(TEST_USER_ID, "C", PlaylistMode.Journey);

        const recent = await Sessions.listRecent(2);
        expect(recent).toHaveLength(2);
      });
    });
  });

  describe("delete", () => {
    describe("when deleting a session", () => {
      it("should remove the session", async () => {
        const session = await Sessions.create(TEST_USER_ID, "Doomed", PlaylistMode.Journey);
        await Sessions.delete(session.id);

        expect(await Sessions.getById(session.id)).toBeNull();
      });

      it("should cascade-delete playlist tracks", async () => {
        const session = await Sessions.create(TEST_USER_ID, "With tracks", PlaylistMode.Journey);
        const gameId = "game-cascade";
        rawDb.prepare("INSERT INTO games (id, title) VALUES (?, ?)").run(gameId, "Cascade Game");
        rawDb
          .prepare(
            "INSERT INTO playlist_tracks (id, playlist_id, game_id, position) VALUES (?, ?, ?, ?)",
          )
          .run("track-del-1", session.id, gameId, 0);

        await Sessions.delete(session.id);

        const tracks = rawDb
          .prepare("SELECT * FROM playlist_tracks WHERE playlist_id = ?")
          .all(session.id);
        expect(tracks).toHaveLength(0);
      });
    });
  });
});
