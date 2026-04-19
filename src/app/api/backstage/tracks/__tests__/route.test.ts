import { describe, it, expect, vi, beforeEach } from "vitest";
import type Database from "better-sqlite3";
import type { DrizzleDB } from "@/lib/db";
import { createTestDrizzleDB, seedTestUser } from "@/lib/db/test-helpers";
import { makeJsonRequest, parseJson } from "@/test/route-helpers";

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

const { POST, PATCH, DELETE: DELETE_HANDLER } = await import("../route");

beforeEach(() => {
  ({ db, rawDb } = createTestDrizzleDB());
  seedTestUser(rawDb);
});

describe("POST /api/backstage/tracks — Zod validation", () => {
  it("returns 400 when gameId is missing", async () => {
    const res = await POST(makeJsonRequest("/api/backstage/tracks", "POST", { name: "Track 1" }));
    expect(res.status).toBe(400);
    const body = await parseJson<{ error: string }>(res);
    expect(body.error).toBe("Invalid request body");
  });

  it("returns 400 when name is empty", async () => {
    const res = await POST(
      makeJsonRequest("/api/backstage/tracks", "POST", { gameId: "g1", name: "" }),
    );
    expect(res.status).toBe(400);
  });
});

describe("PATCH /api/backstage/tracks — Zod validation", () => {
  it("returns 400 when updates block is missing", async () => {
    const res = await PATCH(
      makeJsonRequest("/api/backstage/tracks", "PATCH", { gameId: "g1", name: "t1" }),
    );
    expect(res.status).toBe(400);
    const body = await parseJson<{ error: string }>(res);
    expect(body.error).toBe("Invalid request body");
  });

  it("returns 400 when array form has an invalid entry", async () => {
    const res = await PATCH(
      makeJsonRequest("/api/backstage/tracks", "PATCH", [
        { gameId: "g1", name: "t1", updates: {} },
        { gameId: "g1" },
      ]),
    );
    expect(res.status).toBe(400);
  });
});

describe("DELETE /api/backstage/tracks — Zod validation", () => {
  it("returns 400 for empty keys array", async () => {
    const res = await DELETE_HANDLER(
      makeJsonRequest("/api/backstage/tracks", "DELETE", { keys: [] }),
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 for empty names array", async () => {
    const res = await DELETE_HANDLER(
      makeJsonRequest("/api/backstage/tracks", "DELETE", { gameId: "g1", names: [] }),
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when neither keys nor names shape is provided", async () => {
    const res = await DELETE_HANDLER(
      makeJsonRequest("/api/backstage/tracks", "DELETE", { foo: "bar" }),
    );
    expect(res.status).toBe(400);
  });
});
