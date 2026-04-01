import { describe, it, expect, vi, beforeEach } from "vitest";
import type Database from "better-sqlite3";
import type { DrizzleDB } from "@/lib/db";
import { createTestDrizzleDB, seedTestUser, seedTestGame } from "@/lib/db/test-helpers";
import { TEST_USER_ID } from "@/test/constants";
import { makeGetRequest, parseJson } from "@/test/route-helpers";

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

const { GET } = await import("../route");

beforeEach(() => {
  ({ db, rawDb } = createTestDrizzleDB());
  seedTestUser(rawDb);
});

interface DashboardRow {
  phase: string;
  count: number;
  publishedCount: number;
  needsReviewCount: number;
}

describe("GET /api/backstage/dashboard", () => {
  describe("when games exist", () => {
    it("should return dashboard counts grouped by phase", async () => {
      seedTestGame(rawDb, TEST_USER_ID, {
        id: "g1",
        title: "Game 1",
        onboardingPhase: "tagged",
        published: true,
      });
      seedTestGame(rawDb, TEST_USER_ID, {
        id: "g2",
        title: "Game 2",
        onboardingPhase: "tagged",
        published: false,
      });
      seedTestGame(rawDb, TEST_USER_ID, {
        id: "g3",
        title: "Game 3",
        onboardingPhase: "draft",
        published: false,
      });

      const res = await GET(makeGetRequest("/api/backstage/dashboard"));
      expect(res.status).toBe(200);

      const rows = await parseJson<DashboardRow[]>(res);
      expect(rows.length).toBeGreaterThanOrEqual(2);

      const tagged = rows.find((r) => r.phase === "tagged");
      expect(tagged).toBeDefined();
      expect(tagged!.count).toBe(2);
      expect(tagged!.publishedCount).toBe(1);

      const draft = rows.find((r) => r.phase === "draft");
      expect(draft).toBeDefined();
      expect(draft!.count).toBe(1);
      expect(draft!.publishedCount).toBe(0);
    });
  });

  describe("when no games exist", () => {
    it("should return empty array", async () => {
      const res = await GET(makeGetRequest("/api/backstage/dashboard"));
      expect(res.status).toBe(200);

      const rows = await parseJson<DashboardRow[]>(res);
      expect(rows).toHaveLength(0);
    });
  });
});
