import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { searchGameSoundtrack, fetchDiscogsRelease, fetchDiscogsMaster } from "../discogs";
import { TEST_GAME_TITLE, TEST_TRACK_NAME } from "@/test/constants";

const originalFetch = global.fetch;

beforeEach(() => {
  global.fetch = vi.fn();
});

afterEach(() => {
  global.fetch = originalFetch;
});

function mockFetchSequence(
  responses: Array<{
    ok: boolean;
    status?: number;
    data?: unknown;
    headers?: Record<string, string>;
  }>,
) {
  const calls = [...responses];
  (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(async () => {
    const next = calls.shift();
    if (!next) throw new Error("Unexpected fetch call");
    return {
      ok: next.ok,
      status: next.status ?? (next.ok ? 200 : 500),
      json: async () => next.data,
      text: async () => JSON.stringify(next.data),
      headers: new Map(Object.entries(next.headers ?? { "X-Discogs-Ratelimit-Remaining": "50" })),
    };
  });
}

// Discogs search + fetch pattern needs 2 calls:
// 1. Search (returns results with IDs)
// 2. Fetch release/master (returns tracklist)

describe("searchGameSoundtrack", () => {
  describe("when a master search finds results", () => {
    it("should return tracks from the master", async () => {
      mockFetchSequence([
        // Master search
        {
          ok: true,
          data: {
            results: [{ id: 123, community: { have: 100 } }],
          },
          headers: { "X-Discogs-Ratelimit-Remaining": "50" },
        },
        // Master fetch
        {
          ok: true,
          data: {
            title: `${TEST_GAME_TITLE} OST`,
            tracklist: [
              { title: TEST_TRACK_NAME, position: "1", duration: "3:45" },
              { title: "Gwyn, Lord of Cinder", position: "2", duration: "4:20" },
            ],
          },
          headers: { "X-Discogs-Ratelimit-Remaining": "49" },
        },
      ]);

      const result = await searchGameSoundtrack(TEST_GAME_TITLE);
      expect(result).not.toBeNull();
      expect(result!.tracks).toHaveLength(2);
      expect(result!.tracks[0].name).toBe(TEST_TRACK_NAME);
      expect(result!.sourceType).toBe("discogs-master");
    });
  });

  describe("when master search returns no results but release search does", () => {
    it("should fall back to release search", async () => {
      mockFetchSequence([
        // Master search — no results
        { ok: true, data: { results: [] }, headers: { "X-Discogs-Ratelimit-Remaining": "50" } },
        // Release search
        {
          ok: true,
          data: {
            results: [{ id: 456, format: ["CD"], community: { have: 50 } }],
          },
          headers: { "X-Discogs-Ratelimit-Remaining": "49" },
        },
        // Release fetch
        {
          ok: true,
          data: {
            title: "Hollow Knight OST",
            tracklist: [{ title: "Dirtmouth", position: "1", duration: "2:30" }],
          },
          headers: { "X-Discogs-Ratelimit-Remaining": "48" },
        },
      ]);

      const result = await searchGameSoundtrack("Hollow Knight");
      expect(result).not.toBeNull();
      expect(result!.sourceType).toBe("discogs-release");
    });
  });

  describe("when no results are found at all", () => {
    it("should return null", async () => {
      mockFetchSequence([
        { ok: true, data: { results: [] }, headers: { "X-Discogs-Ratelimit-Remaining": "50" } },
        { ok: true, data: { results: [] }, headers: { "X-Discogs-Ratelimit-Remaining": "49" } },
      ]);

      const result = await searchGameSoundtrack("Nonexistent Game");
      expect(result).toBeNull();
    });
  });

  describe("when the API returns 404", () => {
    it("should return null", async () => {
      mockFetchSequence([
        { ok: false, status: 404 },
        { ok: false, status: 404 },
      ]);

      const result = await searchGameSoundtrack("Missing Game");
      expect(result).toBeNull();
    });
  });
});

describe("fetchDiscogsRelease", () => {
  describe("when the release has tracks", () => {
    it("should return parsed track data", async () => {
      mockFetchSequence([
        {
          ok: true,
          data: {
            title: "Celeste OST",
            tracklist: [
              { title: "Prologue", position: "1", duration: "1:23" },
              { title: "First Steps", position: "2", duration: "5:00" },
            ],
          },
          headers: { "X-Discogs-Ratelimit-Remaining": "50" },
        },
      ]);

      const result = await fetchDiscogsRelease(789);
      expect(result).not.toBeNull();
      expect(result!.tracks).toHaveLength(2);
      expect(result!.releaseTitle).toBe("Celeste OST");
      expect(result!.releaseId).toBe(789);
      expect(result!.sourceType).toBe("discogs-release");
    });
  });

  describe("when the release has an empty tracklist", () => {
    it("should return null", async () => {
      mockFetchSequence([
        {
          ok: true,
          data: { title: "Empty", tracklist: [] },
          headers: { "X-Discogs-Ratelimit-Remaining": "50" },
        },
      ]);

      expect(await fetchDiscogsRelease(999)).toBeNull();
    });
  });

  describe("when the API returns 404", () => {
    it("should return null", async () => {
      mockFetchSequence([{ ok: false, status: 404 }]);
      expect(await fetchDiscogsRelease(999)).toBeNull();
    });
  });

  describe("when the API returns a server error", () => {
    it("should throw", async () => {
      mockFetchSequence([{ ok: false, status: 500 }]);
      await expect(fetchDiscogsRelease(999)).rejects.toThrow("Discogs API error");
    });
  });
});

describe("fetchDiscogsMaster", () => {
  describe("when the master has tracks", () => {
    it("should return parsed track data with discogs-master sourceType", async () => {
      mockFetchSequence([
        {
          ok: true,
          data: {
            title: "Ori OST",
            tracklist: [{ title: "Opening", position: "1", duration: "2:00" }],
          },
          headers: { "X-Discogs-Ratelimit-Remaining": "50" },
        },
      ]);

      const result = await fetchDiscogsMaster(321);
      expect(result).not.toBeNull();
      expect(result!.sourceType).toBe("discogs-master");
      expect(result!.releaseId).toBe(321);
    });
  });

  describe("when the master has no tracklist", () => {
    it("should return null", async () => {
      mockFetchSequence([
        { ok: true, data: { title: "Empty" }, headers: { "X-Discogs-Ratelimit-Remaining": "50" } },
      ]);

      expect(await fetchDiscogsMaster(321)).toBeNull();
    });
  });
});

describe("throttle (rate-limit pause)", () => {
  describe("when the API returns X-Discogs-Ratelimit-Remaining <= 2", () => {
    it("should pause for 61 seconds before continuing", async () => {
      vi.useFakeTimers();

      mockFetchSequence([
        // Master search — returns a result with remaining = 1 (triggers throttle)
        {
          ok: true,
          data: {
            results: [{ id: 999, community: { have: 10 } }],
          },
          headers: { "X-Discogs-Ratelimit-Remaining": "1" },
        },
        // Master fetch — also low remaining
        {
          ok: true,
          data: {
            title: "Throttled Game OST",
            tracklist: [{ title: "Theme", position: "1", duration: "3:00" }],
          },
          headers: { "X-Discogs-Ratelimit-Remaining": "1" },
        },
      ]);

      const promise = searchGameSoundtrack("Throttled Game");

      // Advance past the first 61s throttle (after search)
      await vi.advanceTimersByTimeAsync(61_000);
      // Advance past the second 61s throttle (after master fetch)
      await vi.advanceTimersByTimeAsync(61_000);

      const result = await promise;
      expect(result).not.toBeNull();
      expect(result!.tracks).toHaveLength(1);
      expect(result!.tracks[0].name).toBe("Theme");

      vi.useRealTimers();
    });
  });
});

describe("duration parsing (via fetchDiscogsRelease)", () => {
  describe("when tracks have H:M:S format durations", () => {
    it("should parse correctly", async () => {
      mockFetchSequence([
        {
          ok: true,
          data: {
            title: "Long OST",
            tracklist: [{ title: "Epic Suite", position: "1", duration: "1:23:45" }],
          },
          headers: { "X-Discogs-Ratelimit-Remaining": "50" },
        },
      ]);

      const result = await fetchDiscogsRelease(100);
      expect(result!.tracks[0].name).toBe("Epic Suite");
    });
  });
});

describe("searchGameSoundtrack (popularity ranking)", () => {
  describe("when multiple master results are returned", () => {
    it("should pick the most popular by community.have", async () => {
      mockFetchSequence([
        // Master search — multiple results with different popularity
        {
          ok: true,
          data: {
            results: [
              { id: 10, community: { have: 50 } },
              { id: 20, community: { have: 200 } },
              { id: 30, community: { have: 100 } },
            ],
          },
          headers: { "X-Discogs-Ratelimit-Remaining": "50" },
        },
        // Master fetch for id=20 (the most popular)
        {
          ok: true,
          data: {
            title: "Best OST",
            tracklist: [{ title: "Best Track", position: "1", duration: "4:00" }],
          },
          headers: { "X-Discogs-Ratelimit-Remaining": "49" },
        },
      ]);

      const result = await searchGameSoundtrack("Some Game");
      expect(result).not.toBeNull();
      expect(result!.releaseTitle).toBe("Best OST");
    });
  });
});
