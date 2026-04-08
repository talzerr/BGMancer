import { describe, it, expect, vi, beforeEach } from "vitest";
import type Database from "better-sqlite3";
import type { DrizzleDB } from "@/lib/db";
import { createTestDrizzleDB } from "../../test-helpers";

let db: DrizzleDB;
let rawDb: Database.Database;

vi.mock("@/lib/db", async () => {
  const { MOCK_LOCAL_USER_ID, MOCK_LOCAL_LIBRARY_ID } = await import("@/test/constants");
  return {
    getDB: () => db,
    batch: async (queries: unknown[]) => db.batch(queries as Parameters<typeof db.batch>[0]),
    LOCAL_USER_ID: MOCK_LOCAL_USER_ID,
    LOCAL_LIBRARY_ID: MOCK_LOCAL_LIBRARY_ID,
  };
});

const { GameRequests } = await import("../game-requests");

beforeEach(() => {
  ({ db, rawDb } = createTestDrizzleDB());
});

interface RawRow {
  igdb_id: number;
  name: string;
  cover_url: string | null;
  request_count: number;
  acknowledged: number;
}

function getRow(igdbId: number): RawRow | undefined {
  return rawDb.prepare("SELECT * FROM game_requests WHERE igdb_id = ?").get(igdbId) as
    | RawRow
    | undefined;
}

describe("GameRequests", () => {
  describe("upsertRequest", () => {
    it("should insert a new row with request_count = 1 when igdb_id is new", async () => {
      const result = await GameRequests.upsertRequest(123, "Celeste", "https://img/c.jpg");

      expect(result.igdbId).toBe(123);
      expect(result.name).toBe("Celeste");
      expect(result.coverUrl).toBe("https://img/c.jpg");
      expect(result.requestCount).toBe(1);
      expect(result.acknowledged).toBe(false);

      const row = getRow(123);
      expect(row).toBeDefined();
      expect(row?.request_count).toBe(1);
      expect(row?.acknowledged).toBe(0);
    });

    it("should increment request_count when submitting a duplicate unacknowledged igdb_id", async () => {
      await GameRequests.upsertRequest(123, "Celeste", null);
      const result = await GameRequests.upsertRequest(123, "Celeste", null);

      expect(result.requestCount).toBe(2);
      expect(getRow(123)?.request_count).toBe(2);
    });

    it("should no-op when the row is already acknowledged", async () => {
      await GameRequests.upsertRequest(456, "Hollow Knight", null);
      await GameRequests.acknowledge(456);

      await GameRequests.upsertRequest(456, "Hollow Knight", null);

      const row = getRow(456);
      expect(row?.request_count).toBe(1);
      expect(row?.acknowledged).toBe(1);
    });
  });

  describe("acknowledge", () => {
    it("should flip acknowledged from false to true", async () => {
      await GameRequests.upsertRequest(789, "Signalis", null);
      expect(getRow(789)?.acknowledged).toBe(0);

      await GameRequests.acknowledge(789);
      expect(getRow(789)?.acknowledged).toBe(1);
    });
  });

  describe("getUnacknowledged", () => {
    it("should only return unacknowledged rows, ordered by request_count desc", async () => {
      await GameRequests.upsertRequest(1, "Alpha", null);
      await GameRequests.upsertRequest(2, "Bravo", null);
      await GameRequests.upsertRequest(2, "Bravo", null);
      await GameRequests.upsertRequest(2, "Bravo", null);
      await GameRequests.upsertRequest(3, "Charlie", null);
      await GameRequests.acknowledge(3);

      const result = await GameRequests.getUnacknowledged();

      expect(result).toHaveLength(2);
      expect(result[0].igdbId).toBe(2); // highest count first
      expect(result[0].requestCount).toBe(3);
      expect(result[1].igdbId).toBe(1);
    });
  });

  describe("getAll", () => {
    it("should return all rows regardless of acknowledged state", async () => {
      await GameRequests.upsertRequest(1, "Alpha", null);
      await GameRequests.upsertRequest(2, "Bravo", null);
      await GameRequests.acknowledge(2);

      const result = await GameRequests.getAll();

      expect(result).toHaveLength(2);
      expect(result.map((r) => r.igdbId).sort()).toEqual([1, 2]);
    });
  });
});
