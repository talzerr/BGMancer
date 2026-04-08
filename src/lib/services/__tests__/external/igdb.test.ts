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

    it("filters out DLC and expansions (non-main categories)", async () => {
      mockTokenResponse();
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => [
          { id: 1, name: "Main Game", category: 0 },
          { id: 2, name: "DLC", category: 1 },
          { id: 3, name: "Expansion", category: 2 },
          { id: 4, name: "Remake", category: 8 },
          { id: 5, name: "Remaster", category: 9 },
        ],
      });

      const result = await searchGames("test");
      const ids = result.map((r) => r.igdbId);
      expect(ids).toEqual([1, 4, 5]);
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
});
