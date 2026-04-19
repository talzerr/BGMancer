import { describe, it, expect, vi, beforeEach } from "vitest";
import type Database from "better-sqlite3";
import type { DrizzleDB } from "@/lib/db";
import { createTestDrizzleDB, seedTestUser } from "@/lib/db/test-helpers";
import { makeJsonRequest } from "@/test/route-helpers";

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

beforeEach(() => {
  ({ db, rawDb } = createTestDrizzleDB());
  seedTestUser(rawDb);
});

/**
 * Negative-path regression coverage for the backstage routes that got Zod
 * validation in commit 6911207. The SSE-streaming routes (resolve, retag,
 * load-tracks, etc.) respond 200 with an `error` event instead of 400 — the
 * tests below assert on the error event payload rather than the HTTP status.
 */

async function readSseErrorMessage(res: Response): Promise<string> {
  const text = await res.text();
  // SSE frames look like `data: {...}\n\n`
  const payload = text.split("\n\n").find((f) => f.startsWith("data: "));
  if (!payload) throw new Error(`No SSE data frame in: ${text}`);
  const json = JSON.parse(payload.slice("data: ".length)) as { type: string; message?: string };
  expect(json.type).toBe("error");
  return json.message ?? "";
}

// selectedTrackNamesSchema: resolve-selected, tag-selected (SSE)
describe("selectedTrackNamesSchema routes", () => {
  it.each(["@/app/api/backstage/resolve-selected/route", "@/app/api/backstage/tag-selected/route"])(
    "%s emits an SSE error when trackNames is empty",
    async (modulePath) => {
      const mod = await import(modulePath);
      const res = await mod.POST(
        makeJsonRequest("/api/backstage/_", "POST", { gameId: "g1", trackNames: [] }),
      );
      const message = await readSseErrorMessage(res);
      expect(message).toMatch(/gameId|trackNames/i);
    },
  );

  it.each(["@/app/api/backstage/resolve-selected/route", "@/app/api/backstage/tag-selected/route"])(
    "%s emits an SSE error when gameId is missing",
    async (modulePath) => {
      const mod = await import(modulePath);
      const res = await mod.POST(
        makeJsonRequest("/api/backstage/_", "POST", { trackNames: ["t1"] }),
      );
      const message = await readSseErrorMessage(res);
      expect(message).toMatch(/gameId|trackNames/i);
    },
  );
});

// gameIdBodySchema: resolve, load-tracks, retag, quick-onboard, reingest (all SSE)
describe("gameIdBodySchema routes", () => {
  it.each([
    "@/app/api/backstage/resolve/route",
    "@/app/api/backstage/load-tracks/route",
    "@/app/api/backstage/retag/route",
    "@/app/api/backstage/quick-onboard/route",
    "@/app/api/backstage/reingest/route",
  ])("%s emits an SSE error when gameId is missing", async (modulePath) => {
    const mod = await import(modulePath);
    const res = await mod.POST(makeJsonRequest("/api/backstage/_", "POST", {}));
    const message = await readSseErrorMessage(res);
    expect(message).toMatch(/gameId/i);
  });
});

// publishSchema / bulkPublishSchema
describe("publish/bulk-publish routes", () => {
  it("publish returns 400 when published flag is missing", async () => {
    const mod = await import("@/app/api/backstage/publish/route");
    const res = await mod.POST(makeJsonRequest("/api/backstage/publish", "POST", { gameId: "g1" }));
    expect(res.status).toBe(400);
  });

  it("bulk-publish returns 400 when gameIds is empty", async () => {
    const mod = await import("@/app/api/backstage/bulk-publish/route");
    const res = await mod.POST(
      makeJsonRequest("/api/backstage/bulk-publish", "POST", { gameIds: [], published: true }),
    );
    expect(res.status).toBe(400);
  });
});

// tracksReviewSchema
describe("tracks/review route", () => {
  it("returns 400 when gameId is missing", async () => {
    const mod = await import("@/app/api/backstage/tracks/review/route");
    const res = await mod.POST(
      makeJsonRequest("/api/backstage/tracks/review", "POST", { approve: ["t1"] }),
    );
    expect(res.status).toBe(400);
  });
});
