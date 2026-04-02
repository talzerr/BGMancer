import { describe, it, expect, vi, beforeEach } from "vitest";
import type Database from "better-sqlite3";
import type { DrizzleDB } from "@/lib/db";
import {
  createTestDrizzleDB,
  seedTestUser,
  seedTestGame,
  seedTestSession,
} from "../../test-helpers";
import { ArcPhase, SelectionPass } from "@/types";
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

// Import after mock
const { DirectorDecisions } = await import("../decisions");

let userId: string;
let gameId: string;
let playlistId: string;

beforeEach(() => {
  ({ db, rawDb } = createTestDrizzleDB());
  ({ userId } = seedTestUser(rawDb));
  gameId = seedTestGame(rawDb, userId, { id: "game-decisions" });
  playlistId = seedTestSession(rawDb, userId, { id: "session-decisions" });
});

function makeDecision(
  overrides: Partial<Parameters<typeof DirectorDecisions.bulkInsert>[1][0]> = {},
) {
  return {
    position: 0,
    arcPhase: ArcPhase.Intro,
    gameId,
    trackVideoId: "vid-001",
    roleScore: 0.8,
    moodScore: 0.6,
    instScore: 0.4,
    viewBiasScore: 0.1,
    finalScore: 0.7,
    adjustedScore: 0.65,
    poolSize: 20,
    gameBudget: 10,
    gameBudgetUsed: 3,
    selectionPass: SelectionPass.Scored,
    rubricUsed: true,
    viewBiasActive: false,
    ...overrides,
  };
}

describe("DirectorDecisions", () => {
  describe("bulkInsert", () => {
    it("should insert decisions into the database", async () => {
      const decisions = [
        makeDecision({ position: 0, trackVideoId: "vid-001" }),
        makeDecision({ position: 1, trackVideoId: "vid-002", arcPhase: ArcPhase.Rising }),
      ];

      await DirectorDecisions.bulkInsert(playlistId, decisions);

      const rows = rawDb
        .prepare("SELECT * FROM playlist_track_decisions WHERE playlist_id = ? ORDER BY position")
        .all(playlistId) as Record<string, unknown>[];

      expect(rows).toHaveLength(2);
      expect(rows[0].position).toBe(0);
      expect(rows[0].arc_phase).toBe("intro");
      expect(rows[0].track_video_id).toBe("vid-001");
      expect(rows[1].position).toBe(1);
      expect(rows[1].arc_phase).toBe("rising");
      expect(rows[1].track_video_id).toBe("vid-002");
    });

    it("should store boolean fields as integers (0/1)", async () => {
      await DirectorDecisions.bulkInsert(playlistId, [
        makeDecision({ rubricUsed: true, viewBiasActive: false }),
      ]);

      const row = rawDb
        .prepare(
          "SELECT rubric_used, view_bias_active FROM playlist_track_decisions WHERE playlist_id = ?",
        )
        .get(playlistId) as Record<string, unknown>;

      expect(row.rubric_used).toBe(1);
      expect(row.view_bias_active).toBe(0);
    });

    it("should be a no-op when given an empty array", async () => {
      await DirectorDecisions.bulkInsert(playlistId, []);

      const rows = rawDb
        .prepare("SELECT * FROM playlist_track_decisions WHERE playlist_id = ?")
        .all(playlistId);

      expect(rows).toHaveLength(0);
    });
  });

  describe("listByPlaylist", () => {
    it("should return decisions ordered by position", async () => {
      const decisions = [
        makeDecision({ position: 2, trackVideoId: "vid-c", arcPhase: ArcPhase.Peak }),
        makeDecision({ position: 0, trackVideoId: "vid-a", arcPhase: ArcPhase.Intro }),
        makeDecision({ position: 1, trackVideoId: "vid-b", arcPhase: ArcPhase.Rising }),
      ];
      await DirectorDecisions.bulkInsert(playlistId, decisions);

      const result = await DirectorDecisions.listByPlaylist(playlistId);

      expect(result).toHaveLength(3);
      expect(result[0].position).toBe(0);
      expect(result[1].position).toBe(1);
      expect(result[2].position).toBe(2);
      expect(result[0].trackVideoId).toBe("vid-a");
      expect(result[2].trackVideoId).toBe("vid-c");
    });

    it("should return an empty array for an unknown playlist", async () => {
      const result = await DirectorDecisions.listByPlaylist("nonexistent");

      expect(result).toEqual([]);
    });

    it("should map rubricUsed and viewBiasActive as booleans, not integers", async () => {
      await DirectorDecisions.bulkInsert(playlistId, [
        makeDecision({ position: 0, rubricUsed: true, viewBiasActive: true }),
        makeDecision({ position: 1, rubricUsed: false, viewBiasActive: false }),
      ]);

      const result = await DirectorDecisions.listByPlaylist(playlistId);

      expect(result[0].rubricUsed).toBe(true);
      expect(result[0].viewBiasActive).toBe(true);
      expect(typeof result[0].rubricUsed).toBe("boolean");
      expect(typeof result[0].viewBiasActive).toBe("boolean");

      expect(result[1].rubricUsed).toBe(false);
      expect(result[1].viewBiasActive).toBe(false);
      expect(typeof result[1].rubricUsed).toBe("boolean");
      expect(typeof result[1].viewBiasActive).toBe("boolean");
    });

    it("should correctly map all score fields", async () => {
      const decision = makeDecision({
        roleScore: 0.9,
        moodScore: 0.7,
        instScore: 0.5,
        viewBiasScore: 0.3,
        finalScore: 0.85,
        adjustedScore: 0.82,
        poolSize: 15,
        gameBudget: 8,
        gameBudgetUsed: 4,
        selectionPass: SelectionPass.FocusPre,
        arcPhase: ArcPhase.Climax,
      });
      await DirectorDecisions.bulkInsert(playlistId, [decision]);

      const [result] = await DirectorDecisions.listByPlaylist(playlistId);

      expect(result.roleScore).toBe(0.9);
      expect(result.moodScore).toBe(0.7);
      expect(result.instScore).toBe(0.5);
      expect(result.viewBiasScore).toBe(0.3);
      expect(result.finalScore).toBe(0.85);
      expect(result.adjustedScore).toBe(0.82);
      expect(result.poolSize).toBe(15);
      expect(result.gameBudget).toBe(8);
      expect(result.gameBudgetUsed).toBe(4);
      expect(result.selectionPass).toBe(SelectionPass.FocusPre);
      expect(result.arcPhase).toBe(ArcPhase.Climax);
    });

    it("should not return decisions from a different playlist", async () => {
      const otherPlaylistId = seedTestSession(rawDb, userId, { id: "session-other" });
      await DirectorDecisions.bulkInsert(playlistId, [makeDecision({ position: 0 })]);
      await DirectorDecisions.bulkInsert(otherPlaylistId, [
        makeDecision({ position: 0, trackVideoId: "vid-other" }),
      ]);

      const result = await DirectorDecisions.listByPlaylist(playlistId);

      expect(result).toHaveLength(1);
      expect(result[0].trackVideoId).toBe("vid-001");
    });
  });
});
