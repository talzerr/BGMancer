import { describe, it, expect, vi, beforeEach } from "vitest";
import type Database from "better-sqlite3";
import type { DrizzleDB } from "@/lib/db";
import { createTestDrizzleDB, seedTestUser } from "@/lib/db/test-helpers";
import { makeJsonRequest, parseJson } from "@/test/route-helpers";
import type * as SteamSyncModule from "@/lib/services/external/steam-sync";

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

vi.mock("@/lib/services/auth/auth-helpers", async () => {
  const { TEST_USER_ID } = await import("@/test/constants");
  return {
    getAuthUserId: async () => TEST_USER_ID,
    getAuthSession: async () => ({ authenticated: true, userId: TEST_USER_ID }),
    AuthRequiredError: class extends Error {},
  };
});

vi.mock("@/lib/services/external/steam-sync", async () => {
  const actual = await vi.importActual<typeof SteamSyncModule>(
    "@/lib/services/external/steam-sync",
  );
  return {
    ...actual,
    syncUserLibrary: vi.fn(),
  };
});

const {
  syncUserLibrary,
  MissingSteamUrlError,
  VanityNotFoundError,
  PrivateProfileError,
  CooldownError,
  SteamApiError,
} = await import("@/lib/services/external/steam-sync");

const { POST } = await import("../route");

beforeEach(() => {
  ({ db, rawDb } = createTestDrizzleDB());
  seedTestUser(rawDb);
  vi.mocked(syncUserLibrary).mockReset();
});

describe("POST /api/steam/sync", () => {
  describe("when the sync succeeds", () => {
    it("returns 200 with the result", async () => {
      vi.mocked(syncUserLibrary).mockResolvedValue({
        totalSynced: 10,
        catalogMatches: 3,
        steamSyncedAt: "2026-04-07T12:00:00.000Z",
      });

      const res = await POST(
        makeJsonRequest("/api/steam/sync", "POST", {
          steamUrl: "https://steamcommunity.com/id/foo",
        }),
      );

      expect(res.status).toBe(200);
      const body = await parseJson<{
        totalSynced: number;
        catalogMatches: number;
        steamSyncedAt: string;
      }>(res);
      expect(body).toEqual({
        totalSynced: 10,
        catalogMatches: 3,
        steamSyncedAt: "2026-04-07T12:00:00.000Z",
      });
    });
  });

  describe("when the body is not an object", () => {
    it("returns 400", async () => {
      // Raw non-object JSON body
      const req = new Request("http://localhost:6959/api/steam/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify("not-an-object"),
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });
  });

  describe("when the steamUrl is not a steamcommunity URL", () => {
    it("returns 400", async () => {
      const res = await POST(
        makeJsonRequest("/api/steam/sync", "POST", {
          steamUrl: "https://example.com/user/foo",
        }),
      );
      expect(res.status).toBe(400);
    });
  });

  describe("when the service throws MissingSteamUrlError", () => {
    it("returns 400 with the required message", async () => {
      vi.mocked(syncUserLibrary).mockRejectedValue(new MissingSteamUrlError());

      const res = await POST(makeJsonRequest("/api/steam/sync", "POST", {}));
      expect(res.status).toBe(400);

      const body = await parseJson<{ error: string }>(res);
      expect(body.error).toBe("Steam profile URL is required to connect.");
    });
  });

  describe("when the service throws VanityNotFoundError", () => {
    it("returns 404 with the vanity-not-found message", async () => {
      vi.mocked(syncUserLibrary).mockRejectedValue(new VanityNotFoundError());

      const res = await POST(
        makeJsonRequest("/api/steam/sync", "POST", {
          steamUrl: "https://steamcommunity.com/id/nonexistent",
        }),
      );
      expect(res.status).toBe(404);

      const body = await parseJson<{ error: string }>(res);
      expect(body.error).toBe("Couldn't find a Steam profile with that URL. Check and try again.");
    });
  });

  describe("when the service throws PrivateProfileError", () => {
    it("returns 400 with the private profile message", async () => {
      vi.mocked(syncUserLibrary).mockRejectedValue(new PrivateProfileError());

      const res = await POST(
        makeJsonRequest("/api/steam/sync", "POST", {
          steamUrl: "https://steamcommunity.com/id/foo",
        }),
      );
      expect(res.status).toBe(400);

      const body = await parseJson<{ error: string }>(res);
      expect(body.error).toMatch(/private/i);
    });
  });

  describe("when the service throws CooldownError", () => {
    it("returns 429 with the minutes remaining", async () => {
      vi.mocked(syncUserLibrary).mockRejectedValue(new CooldownError(42));

      const res = await POST(
        makeJsonRequest("/api/steam/sync", "POST", {
          steamUrl: "https://steamcommunity.com/id/foo",
        }),
      );
      expect(res.status).toBe(429);

      const body = await parseJson<{ error: string; cooldownMinutes: number }>(res);
      expect(body.error).toBe("Steam library was synced recently. Try again in 42 minutes.");
      expect(body.cooldownMinutes).toBe(42);
    });
  });

  describe("when the service throws SteamApiError", () => {
    it("returns 502 without leaking internal details", async () => {
      vi.mocked(syncUserLibrary).mockRejectedValue(
        new SteamApiError("ECONNREFUSED to steampowered.com port 443"),
      );

      const res = await POST(
        makeJsonRequest("/api/steam/sync", "POST", {
          steamUrl: "https://steamcommunity.com/id/foo",
        }),
      );
      expect(res.status).toBe(502);

      const body = await parseJson<{ error: string }>(res);
      expect(body.error).toBe("Could not reach Steam. Please try again.");
      expect(body.error).not.toMatch(/ECONNREFUSED/);
      expect(body.error).not.toMatch(/steampowered/);
    });
  });

  describe("when the service throws an unknown error", () => {
    it("returns 500 without leaking internal details", async () => {
      vi.mocked(syncUserLibrary).mockRejectedValue(new Error("db exploded at line 42"));

      const res = await POST(
        makeJsonRequest("/api/steam/sync", "POST", {
          steamUrl: "https://steamcommunity.com/id/foo",
        }),
      );
      expect(res.status).toBe(500);

      const body = await parseJson<{ error: string }>(res);
      expect(body.error).toBe("Something went wrong. Please try again.");
      expect(body.error).not.toMatch(/db exploded/);
      expect(body.error).not.toMatch(/line 42/);
    });
  });
});
