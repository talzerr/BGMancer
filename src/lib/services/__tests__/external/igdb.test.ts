import { describe, it, expect, vi, beforeEach } from "vitest";

let mockClientId: string | undefined = "test-id";
let mockClientSecret: string | undefined = "test-secret";

vi.mock("@/lib/env", () => ({
  env: new Proxy(
    {},
    {
      get(_target, prop) {
        if (prop === "igdbClientId") return mockClientId;
        if (prop === "igdbClientSecret") return mockClientSecret;
        return undefined;
      },
    },
  ),
}));

const fetchSpy = vi.fn();
vi.stubGlobal("fetch", fetchSpy);

const { searchGames, _resetIgdbTokenCacheForTest } = await import("../../external/igdb");

beforeEach(() => {
  mockClientId = "test-id";
  mockClientSecret = "test-secret";
  fetchSpy.mockReset();
  _resetIgdbTokenCacheForTest();
});

function mockTokenResponse() {
  fetchSpy.mockResolvedValueOnce({
    ok: true,
    json: async () => ({ access_token: "tok-abc", expires_in: 3600 }),
  });
}

describe("searchGames", () => {
  describe("when credentials are missing", () => {
    it("returns an empty array without calling fetch", async () => {
      mockClientId = undefined;
      const result = await searchGames("celeste");
      expect(result).toEqual([]);
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });

  describe("when the token request fails", () => {
    it("returns an empty array", async () => {
      fetchSpy.mockResolvedValueOnce({ ok: false, status: 401 });
      const result = await searchGames("celeste");
      expect(result).toEqual([]);
    });
  });

  describe("when the search succeeds", () => {
    it("returns mapped results with cover URL", async () => {
      mockTokenResponse();
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => [
          { id: 1, name: "Celeste", category: 0, cover: { image_id: "abc" } },
          { id: 2, name: "Celeste Classic", category: 0, cover: { image_id: "def" } },
        ],
      });

      const result = await searchGames("celeste");

      expect(result).toEqual([
        {
          igdbId: 1,
          name: "Celeste",
          coverUrl: "https://images.igdb.com/igdb/image/upload/t_thumb/abc.jpg",
        },
        {
          igdbId: 2,
          name: "Celeste Classic",
          coverUrl: "https://images.igdb.com/igdb/image/upload/t_thumb/def.jpg",
        },
      ]);
    });

    it("handles games without a cover", async () => {
      mockTokenResponse();
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => [{ id: 1, name: "Obscure Game", category: 0 }],
      });

      const result = await searchGames("obscure");
      expect(result[0].coverUrl).toBeNull();
    });

    it("filters out junk categories but keeps main/expansion/remake/remaster", async () => {
      mockTokenResponse();
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => [
          { id: 1, name: "Main Game", category: 0 },
          { id: 2, name: "DLC", category: 1 },
          { id: 3, name: "Expansion", category: 2 },
          { id: 4, name: "Bundle", category: 3 },
          { id: 5, name: "Standalone Expansion", category: 4 },
          { id: 6, name: "Mod", category: 5 },
          { id: 7, name: "Remake", category: 8 },
          { id: 8, name: "Remaster", category: 9 },
          { id: 10, name: "Pack", category: 13 },
        ],
      });

      const result = await searchGames("test");
      const ids = result.map((r) => r.igdbId);
      expect(ids).toEqual([1, 3, 5, 7, 8]);
    });

    it("filters out rows with parent_game (DLC/content packs)", async () => {
      mockTokenResponse();
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => [
          { id: 1, name: "Call of Duty 2", category: 0 },
          { id: 2, name: "Call of Duty 2: Bonus Map Pack", category: 0, parent_game: 1 },
          { id: 3, name: "Call of Duty 2: Skirmish Map Pack", category: 0, parent_game: 1 },
        ],
      });

      const result = await searchGames("call of duty 2");
      expect(result.map((r) => r.igdbId)).toEqual([1]);
    });

    it("filters out rows with version_parent (platform re-releases)", async () => {
      mockTokenResponse();
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => [
          { id: 1, name: "Celeste", category: 0 },
          { id: 2, name: "Celeste", category: 0, version_parent: 1 },
          { id: 3, name: "Celeste", category: 0, version_parent: 1 },
        ],
      });

      const result = await searchGames("celeste");
      expect(result.map((r) => r.igdbId)).toEqual([1]);
    });

    it("dedupes results by lowercased name keeping the first occurrence", async () => {
      mockTokenResponse();
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => [
          { id: 1, name: "Call of Duty 2", category: 0 },
          { id: 2, name: "CALL OF DUTY 2", category: 0 },
          { id: 3, name: "Call of Duty 2: Big Red One", category: 0 },
        ],
      });

      const result = await searchGames("call of duty 2");
      expect(result.map((r) => r.igdbId)).toEqual([1, 3]);
    });

    it("caps results at 10", async () => {
      mockTokenResponse();
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () =>
          Array.from({ length: 20 }, (_, i) => ({
            id: i + 1,
            name: `Game ${i + 1}`,
            category: 0,
          })),
      });

      const result = await searchGames("test");
      expect(result).toHaveLength(10);
    });
  });

  describe("when the search API returns an error", () => {
    it("returns an empty array", async () => {
      mockTokenResponse();
      fetchSpy.mockResolvedValueOnce({ ok: false, status: 500 });
      const result = await searchGames("celeste");
      expect(result).toEqual([]);
    });
  });

  describe("when fetch throws", () => {
    it("returns an empty array", async () => {
      mockTokenResponse();
      fetchSpy.mockRejectedValueOnce(new Error("network down"));
      const result = await searchGames("celeste");
      expect(result).toEqual([]);
    });
  });

  describe("when the token request itself throws", () => {
    it("returns an empty array (caught by getAccessToken)", async () => {
      fetchSpy.mockRejectedValueOnce(new Error("dns failure"));
      const result = await searchGames("celeste");
      expect(result).toEqual([]);
    });
  });

  describe("when the token cache is warm", () => {
    it("reuses the cached token without re-fetching", async () => {
      // First call: token fetch + search
      mockTokenResponse();
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => [{ id: 1, name: "Celeste", category: 0 }],
      });
      await searchGames("celeste");
      expect(fetchSpy).toHaveBeenCalledTimes(2);

      // Second call: only the search fetch — token comes from cache.
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => [{ id: 2, name: "Celeste 2", category: 0 }],
      });
      const result = await searchGames("celeste 2");
      expect(fetchSpy).toHaveBeenCalledTimes(3);
      expect(result[0].name).toBe("Celeste 2");
    });
  });
});
