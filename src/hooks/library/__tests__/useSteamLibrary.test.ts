// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useSteamLibrary } from "../useSteamLibrary";
import { STEAM_SYNC_COOLDOWN_MS } from "@/lib/constants";

// ─── Fetch mock plumbing ────────────────────────────────────────────────────

type FetchHandler = (url: string, init?: RequestInit) => Promise<Response>;

const originalFetch = global.fetch;

function mockFetch(handler: FetchHandler) {
  global.fetch = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    return handler(url, init);
  }) as typeof fetch;
}

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: "OK",
    json: async () => body,
    text: async () => JSON.stringify(body),
    headers: new Headers(),
    url: "",
  } as unknown as Response;
}

afterEach(() => {
  global.fetch = originalFetch;
  vi.useRealTimers();
});

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("useSteamLibrary", () => {
  describe("when the user is not signed in", () => {
    beforeEach(() => {
      mockFetch(async () => jsonResponse({ linked: false }));
    });

    it("skips fetching and reports unlinked state", async () => {
      const { result } = renderHook(() => useSteamLibrary(false));

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.linked).toBe(false);
      expect(result.current.matchedGameIds).toEqual([]);
      expect(result.current.steamSyncedAt).toBeNull();
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });

  describe("when the user is signed in and linked", () => {
    beforeEach(() => {
      mockFetch(async (url) => {
        if (url === "/api/steam/library") {
          return jsonResponse({
            linked: true,
            steamSyncedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2h ago
            matchedGameIds: ["g1", "g2"],
          });
        }
        throw new Error(`Unexpected fetch: ${url}`);
      });
    });

    it("loads link status and matched game IDs", async () => {
      const { result } = renderHook(() => useSteamLibrary(true));

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.linked).toBe(true);
      expect(result.current.matchedGameIds).toEqual(["g1", "g2"]);
      expect(result.current.steamSyncedAt).not.toBeNull();
    });

    it("derives cooldownMinutes as null when the cooldown window has elapsed", async () => {
      const { result } = renderHook(() => useSteamLibrary(true));

      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current.cooldownMinutes).toBeNull();
    });
  });

  describe("when the user is signed in but not linked", () => {
    beforeEach(() => {
      mockFetch(async () => jsonResponse({ linked: false }));
    });

    it("reports unlinked state", async () => {
      const { result } = renderHook(() => useSteamLibrary(true));

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.linked).toBe(false);
      expect(result.current.matchedGameIds).toEqual([]);
      expect(result.current.cooldownMinutes).toBeNull();
    });
  });

  describe("cooldownMinutes derivation", () => {
    it("derives a positive value within the cooldown window", async () => {
      const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
      mockFetch(async () =>
        jsonResponse({
          linked: true,
          steamSyncedAt: thirtyMinAgo,
          matchedGameIds: [],
        }),
      );

      const { result } = renderHook(() => useSteamLibrary(true));

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.cooldownMinutes).toBeGreaterThan(28);
      expect(result.current.cooldownMinutes).toBeLessThanOrEqual(30);
    });

    it("returns null once the cooldown window has elapsed", async () => {
      const longAgo = new Date(Date.now() - 2 * STEAM_SYNC_COOLDOWN_MS).toISOString();
      mockFetch(async () =>
        jsonResponse({
          linked: true,
          steamSyncedAt: longAgo,
          matchedGameIds: [],
        }),
      );

      const { result } = renderHook(() => useSteamLibrary(true));
      await waitFor(() => expect(result.current.linked).toBe(true));

      expect(result.current.cooldownMinutes).toBeNull();
    });
  });

  describe("sync()", () => {
    it("returns true and refetches on success", async () => {
      let fetchLibraryCalls = 0;
      mockFetch(async (url, init) => {
        if (url === "/api/steam/library") {
          fetchLibraryCalls += 1;
          return jsonResponse({
            linked: true,
            steamSyncedAt: new Date().toISOString(),
            matchedGameIds: ["g1"],
          });
        }
        if (url === "/api/steam/sync" && init?.method === "POST") {
          return jsonResponse({
            totalSynced: 10,
            catalogMatches: 1,
            steamSyncedAt: new Date().toISOString(),
          });
        }
        throw new Error(`Unexpected fetch: ${url}`);
      });

      const { result } = renderHook(() => useSteamLibrary(true));
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      const initialCalls = fetchLibraryCalls;

      let ok = false;
      await act(async () => {
        ok = await result.current.sync("https://steamcommunity.com/id/foo");
      });

      expect(ok).toBe(true);
      expect(fetchLibraryCalls).toBe(initialCalls + 1);
      expect(result.current.error).toBeNull();
    });

    it("returns false and sets error on 429", async () => {
      mockFetch(async (url, init) => {
        if (url === "/api/steam/library") {
          return jsonResponse({
            linked: true,
            steamSyncedAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
            matchedGameIds: [],
          });
        }
        if (url === "/api/steam/sync" && init?.method === "POST") {
          return jsonResponse(
            {
              error: "Steam library was synced recently. Try again in 50 minutes.",
              cooldownMinutes: 50,
            },
            429,
          );
        }
        throw new Error(`Unexpected fetch: ${url}`);
      });

      const { result } = renderHook(() => useSteamLibrary(true));
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      let ok = true;
      await act(async () => {
        ok = await result.current.sync();
      });

      expect(ok).toBe(false);
      expect(result.current.error).toMatch(/recently/);
      expect(result.current.cooldownMinutes).toBeGreaterThan(0);
    });

    it("handles non-JSON error bodies gracefully", async () => {
      mockFetch(async (url, init) => {
        if (url === "/api/steam/library") {
          return jsonResponse({ linked: false });
        }
        if (url === "/api/steam/sync" && init?.method === "POST") {
          return {
            ok: false,
            status: 500,
            statusText: "ISE",
            json: async () => {
              throw new Error("not json");
            },
            text: async () => "oops",
            headers: new Headers(),
            url: "",
          } as unknown as Response;
        }
        throw new Error(`Unexpected fetch: ${url}`);
      });

      const { result } = renderHook(() => useSteamLibrary(true));
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      let ok = true;
      await act(async () => {
        ok = await result.current.sync("https://steamcommunity.com/id/foo");
      });

      expect(ok).toBe(false);
      expect(result.current.error).toBe("Steam sync failed.");
    });

    it("sets error on network failure", async () => {
      mockFetch(async (url, init) => {
        if (url === "/api/steam/library") {
          return jsonResponse({ linked: false });
        }
        if (url === "/api/steam/sync" && init?.method === "POST") {
          throw new Error("network down");
        }
        throw new Error(`Unexpected fetch: ${url}`);
      });

      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const { result } = renderHook(() => useSteamLibrary(true));
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      let ok = true;
      await act(async () => {
        ok = await result.current.sync("https://steamcommunity.com/id/foo");
      });

      expect(ok).toBe(false);
      expect(result.current.error).toBe("Could not reach server.");
      consoleSpy.mockRestore();
    });
  });

  describe("disconnect()", () => {
    it("returns true and clears linked state on success", async () => {
      mockFetch(async (url, init) => {
        if (url === "/api/steam/library") {
          return jsonResponse({
            linked: true,
            steamSyncedAt: new Date().toISOString(),
            matchedGameIds: ["g1"],
          });
        }
        if (url === "/api/steam/link" && init?.method === "DELETE") {
          return jsonResponse({ success: true });
        }
        throw new Error(`Unexpected fetch: ${url}`);
      });

      const { result } = renderHook(() => useSteamLibrary(true));
      await waitFor(() => expect(result.current.linked).toBe(true));

      let ok = false;
      await act(async () => {
        ok = await result.current.disconnect();
      });

      expect(ok).toBe(true);
      expect(result.current.linked).toBe(false);
      expect(result.current.matchedGameIds).toEqual([]);
      expect(result.current.steamSyncedAt).toBeNull();
    });

    it("returns false and sets error on failure", async () => {
      mockFetch(async (url, init) => {
        if (url === "/api/steam/library") {
          return jsonResponse({
            linked: true,
            steamSyncedAt: new Date().toISOString(),
            matchedGameIds: [],
          });
        }
        if (url === "/api/steam/link" && init?.method === "DELETE") {
          return jsonResponse({ error: "nope" }, 500);
        }
        throw new Error(`Unexpected fetch: ${url}`);
      });

      const { result } = renderHook(() => useSteamLibrary(true));
      await waitFor(() => expect(result.current.linked).toBe(true));

      let ok = true;
      await act(async () => {
        ok = await result.current.disconnect();
      });

      expect(ok).toBe(false);
      expect(result.current.error).toMatch(/disconnect/i);
      expect(result.current.linked).toBe(true); // unchanged
    });

    it("sets error on network failure", async () => {
      mockFetch(async (url, init) => {
        if (url === "/api/steam/library") {
          return jsonResponse({
            linked: true,
            steamSyncedAt: new Date().toISOString(),
            matchedGameIds: [],
          });
        }
        if (url === "/api/steam/link" && init?.method === "DELETE") {
          throw new Error("network down");
        }
        throw new Error(`Unexpected fetch: ${url}`);
      });

      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const { result } = renderHook(() => useSteamLibrary(true));
      await waitFor(() => expect(result.current.linked).toBe(true));

      let ok = true;
      await act(async () => {
        ok = await result.current.disconnect();
      });

      expect(ok).toBe(false);
      expect(result.current.error).toBe("Could not reach server.");
      consoleSpy.mockRestore();
    });
  });

  describe("fetchLibrary error handling", () => {
    it("sets error when /api/steam/library returns non-OK", async () => {
      mockFetch(async () => jsonResponse({ error: "ISE" }, 500));

      const { result } = renderHook(() => useSteamLibrary(true));
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.error).toBe("Could not load Steam library.");
      expect(result.current.linked).toBe(false);
    });

    it("sets error when /api/steam/library throws", async () => {
      mockFetch(async () => {
        throw new Error("network down");
      });
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const { result } = renderHook(() => useSteamLibrary(true));
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.error).toBe("Could not load Steam library.");
      consoleSpy.mockRestore();
    });
  });
});
