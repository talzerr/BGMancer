import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from "vitest";
import type Database from "better-sqlite3";
import type { DrizzleDB } from "@/lib/db";
import { createTestDrizzleDB, seedTestUser } from "@/lib/db/test-helpers";
import { TEST_USER_ID } from "@/test/constants";
import { _reloadEnvForTest } from "@/lib/env";

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

const {
  parseSteamInput,
  syncUserLibrary,
  InvalidSteamUrlError,
  MissingSteamUrlError,
  PrivateProfileError,
  CooldownError,
} = await import("../../external/steam-sync");

// ─── Fetch mock plumbing ────────────────────────────────────────────────────

const originalFetch = global.fetch;

function mockFetch(impl: (url: string, opts?: RequestInit) => Promise<Response>) {
  global.fetch = vi.fn(impl) as typeof fetch;
}

function jsonResponse(data: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    statusText: ok ? "OK" : "Error",
    json: async () => data,
    text: async () => JSON.stringify(data),
    url: "https://api.steampowered.com/test",
    headers: new Headers(),
  } as unknown as Response;
}

beforeAll(() => {
  process.env.STEAM_API_KEY = "test-key";
  _reloadEnvForTest();
});

afterEach(() => {
  global.fetch = originalFetch;
});

// ─── parseSteamInput ────────────────────────────────────────────────────────

describe("parseSteamInput", () => {
  describe("when given a vanity URL", () => {
    it("parses as vanity", () => {
      expect(parseSteamInput("https://steamcommunity.com/id/foo")).toEqual({
        kind: "vanity",
        value: "foo",
      });
    });

    it("trims trailing slashes", () => {
      expect(parseSteamInput("https://steamcommunity.com/id/foo/")).toEqual({
        kind: "vanity",
        value: "foo",
      });
    });

    it("accepts http:// variant", () => {
      expect(parseSteamInput("http://steamcommunity.com/id/bar")).toEqual({
        kind: "vanity",
        value: "bar",
      });
    });
  });

  describe("when given a profile URL", () => {
    it("parses as profile", () => {
      expect(parseSteamInput("https://steamcommunity.com/profiles/76561198000000000")).toEqual({
        kind: "profile",
        value: "76561198000000000",
      });
    });
  });

  describe("when given a bare 17-digit SteamID64", () => {
    it("parses as id", () => {
      expect(parseSteamInput("76561198000000000")).toEqual({
        kind: "id",
        value: "76561198000000000",
      });
    });
  });

  describe("when given gibberish", () => {
    it("throws InvalidSteamUrlError", () => {
      expect(() => parseSteamInput("not a url")).toThrow(InvalidSteamUrlError);
    });

    it("throws on empty string", () => {
      expect(() => parseSteamInput("")).toThrow(InvalidSteamUrlError);
    });
  });
});

// ─── syncUserLibrary ────────────────────────────────────────────────────────

describe("syncUserLibrary", () => {
  beforeEach(() => {
    ({ db, rawDb } = createTestDrizzleDB());
    seedTestUser(rawDb);
  });

  describe("when the user has no stored steam_id and no URL is provided", () => {
    it("throws MissingSteamUrlError", async () => {
      await expect(syncUserLibrary(TEST_USER_ID, {})).rejects.toThrow(MissingSteamUrlError);
    });
  });

  describe("when performing a first sync with a vanity URL", () => {
    beforeEach(() => {
      mockFetch(async (url) => {
        if (url.includes("ResolveVanityURL")) {
          return jsonResponse({
            response: { success: 1, steamid: "76561198000000000" },
          });
        }
        if (url.includes("GetOwnedGames")) {
          return jsonResponse({
            response: {
              games: [
                { appid: 100, playtime_forever: 50 },
                { appid: 200, playtime_forever: 10 },
                { appid: 300, playtime_forever: 500 },
              ],
            },
          });
        }
        throw new Error(`Unexpected fetch: ${url}`);
      });

      // Seed a published catalog game whose steam_appid matches one of the owned appids
      rawDb
        .prepare(
          "INSERT INTO games (id, title, steam_appid, published, onboarding_phase) VALUES (?, ?, ?, 1, 'tagged')",
        )
        .run("catalog-game-1", "Catalog Game 1", 100);
    });

    it("returns totalSynced, catalogMatches, and steamSyncedAt", async () => {
      const result = await syncUserLibrary(TEST_USER_ID, {
        steamUrl: "https://steamcommunity.com/id/foo",
        now: new Date("2026-04-07T12:00:00Z"),
      });

      expect(result.totalSynced).toBe(3);
      expect(result.catalogMatches).toBe(1);
      expect(result.steamSyncedAt).toBe("2026-04-07T12:00:00.000Z");
    });

    it("persists steam_id on the user row", async () => {
      await syncUserLibrary(TEST_USER_ID, {
        steamUrl: "https://steamcommunity.com/id/foo",
        now: new Date("2026-04-07T12:00:00Z"),
      });

      const row = rawDb
        .prepare("SELECT steam_id, steam_synced_at FROM users WHERE id = ?")
        .get(TEST_USER_ID) as { steam_id: string; steam_synced_at: string };
      expect(row.steam_id).toBe("76561198000000000");
      expect(row.steam_synced_at).toBe("2026-04-07T12:00:00.000Z");
    });

    it("inserts user_steam_games rows", async () => {
      await syncUserLibrary(TEST_USER_ID, {
        steamUrl: "https://steamcommunity.com/id/foo",
        now: new Date("2026-04-07T12:00:00Z"),
      });

      const rows = rawDb
        .prepare("SELECT steam_app_id FROM user_steam_games WHERE user_id = ?")
        .all(TEST_USER_ID) as Array<{ steam_app_id: number }>;
      expect(rows).toHaveLength(3);
      const appids = rows.map((r) => r.steam_app_id).sort((a, b) => a - b);
      expect(appids).toEqual([100, 200, 300]);
    });
  });

  describe("when the cooldown has not elapsed", () => {
    it("throws CooldownError with the remaining minutes", async () => {
      // Manually set stored steam_id and steam_synced_at 30 minutes ago
      rawDb
        .prepare("UPDATE users SET steam_id = ?, steam_synced_at = ? WHERE id = ?")
        .run("76561198000000000", "2026-04-07T11:30:00.000Z", TEST_USER_ID);

      let thrown: unknown;
      try {
        await syncUserLibrary(TEST_USER_ID, { now: new Date("2026-04-07T12:00:00Z") });
      } catch (err) {
        thrown = err;
      }
      expect(thrown).toBeInstanceOf(CooldownError);
      expect((thrown as InstanceType<typeof CooldownError>).minutesRemaining).toBe(30);
    });
  });

  describe("when the Steam profile is private", () => {
    beforeEach(() => {
      rawDb
        .prepare("UPDATE users SET steam_id = ? WHERE id = ?")
        .run("76561198000000000", TEST_USER_ID);

      mockFetch(async (url) => {
        if (url.includes("GetOwnedGames")) {
          return jsonResponse({ response: {} });
        }
        throw new Error(`Unexpected fetch: ${url}`);
      });
    });

    it("throws PrivateProfileError", async () => {
      await expect(
        syncUserLibrary(TEST_USER_ID, { now: new Date("2026-04-07T12:00:00Z") }),
      ).rejects.toThrow(PrivateProfileError);
    });
  });

  describe("when the owned games exceed the 500-game cap", () => {
    beforeEach(() => {
      rawDb
        .prepare("UPDATE users SET steam_id = ? WHERE id = ?")
        .run("76561198000000000", TEST_USER_ID);

      const games = Array.from({ length: 600 }, (_, i) => ({
        appid: 1000 + i,
        playtime_forever: i,
      }));

      mockFetch(async (url) => {
        if (url.includes("GetOwnedGames")) {
          return jsonResponse({ response: { games } });
        }
        throw new Error(`Unexpected fetch: ${url}`);
      });
    });

    it("caps totalSynced at 500", async () => {
      const result = await syncUserLibrary(TEST_USER_ID, {
        now: new Date("2026-04-07T12:00:00Z"),
      });
      expect(result.totalSynced).toBe(500);
    });

    it("keeps only the top 500 games by playtime", async () => {
      await syncUserLibrary(TEST_USER_ID, { now: new Date("2026-04-07T12:00:00Z") });

      const rows = rawDb
        .prepare("SELECT steam_app_id, playtime_minutes FROM user_steam_games WHERE user_id = ?")
        .all(TEST_USER_ID) as Array<{ steam_app_id: number; playtime_minutes: number }>;

      expect(rows).toHaveLength(500);
      // Top 500 by playtime = playtimes 100..599 → appids 1100..1599
      const playtimes = rows.map((r) => r.playtime_minutes).sort((a, b) => a - b);
      expect(playtimes[0]).toBe(100);
      expect(playtimes[playtimes.length - 1]).toBe(599);
      // The dropped ones (playtime 0..99 → appids 1000..1099) must not be present
      const appids = rows.map((r) => r.steam_app_id);
      expect(appids).not.toContain(1000);
      expect(appids).not.toContain(1099);
      expect(appids).toContain(1100);
      expect(appids).toContain(1599);
    });
  });

  describe("when counting catalog matches", () => {
    beforeEach(() => {
      rawDb
        .prepare("UPDATE users SET steam_id = ? WHERE id = ?")
        .run("76561198000000000", TEST_USER_ID);

      // Published catalog games — these should count as matches.
      rawDb
        .prepare(
          "INSERT INTO games (id, title, steam_appid, published, onboarding_phase) VALUES (?, ?, ?, 1, 'tagged')",
        )
        .run("pub-1", "Pub 1", 10);
      rawDb
        .prepare(
          "INSERT INTO games (id, title, steam_appid, published, onboarding_phase) VALUES (?, ?, ?, 1, 'tagged')",
        )
        .run("pub-2", "Pub 2", 20);
      // Unpublished — must NOT count even though user owns it.
      rawDb
        .prepare(
          "INSERT INTO games (id, title, steam_appid, published, onboarding_phase) VALUES (?, ?, ?, 0, 'draft')",
        )
        .run("unpub", "Unpub", 30);

      mockFetch(async (url) => {
        if (url.includes("GetOwnedGames")) {
          return jsonResponse({
            response: {
              games: [
                { appid: 10, playtime_forever: 100 },
                { appid: 20, playtime_forever: 200 },
                { appid: 30, playtime_forever: 300 },
                { appid: 999, playtime_forever: 50 }, // not in catalog at all
              ],
            },
          });
        }
        throw new Error(`Unexpected fetch: ${url}`);
      });
    });

    it("counts only published catalog overlap", async () => {
      const result = await syncUserLibrary(TEST_USER_ID, {
        now: new Date("2026-04-07T12:00:00Z"),
      });
      expect(result.catalogMatches).toBe(2);
    });
  });
});
