import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeGetRequest, parseJson } from "@/test/route-helpers";

let mockClientId: string | undefined = "test-id";
let mockClientSecret: string | undefined = "test-secret";

vi.mock("@/lib/env", () => ({
  env: new Proxy(
    {},
    {
      get(_target, prop) {
        if (prop === "igdbClientId") return mockClientId;
        if (prop === "igdbClientSecret") return mockClientSecret;
        if (prop === "isDev") return true;
        return undefined;
      },
    },
  ),
}));

vi.mock("@/lib/services/external/igdb", () => ({
  searchGames: vi.fn(),
}));

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn(),
  getClientIp: () => "1.2.3.4",
}));

const { searchGames } = await import("@/lib/services/external/igdb");
const { checkRateLimit } = await import("@/lib/rate-limit");
const { GET } = await import("../route");

beforeEach(() => {
  mockClientId = "test-id";
  mockClientSecret = "test-secret";
  vi.mocked(searchGames).mockReset();
  vi.mocked(checkRateLimit).mockReset();
  vi.mocked(checkRateLimit).mockResolvedValue({ allowed: true });
});

describe("GET /api/games/search-igdb", () => {
  describe("when IGDB credentials are not configured", () => {
    it("returns 404", async () => {
      mockClientId = undefined;
      const res = await GET(makeGetRequest("/api/games/search-igdb", { q: "celeste" }));
      expect(res.status).toBe(404);
    });
  });

  describe("when the query param is missing", () => {
    it("returns 400", async () => {
      const res = await GET(makeGetRequest("/api/games/search-igdb"));
      expect(res.status).toBe(400);
    });
  });

  describe("when the query is too long", () => {
    it("returns 400", async () => {
      const res = await GET(makeGetRequest("/api/games/search-igdb", { q: "a".repeat(101) }));
      expect(res.status).toBe(400);
    });
  });

  describe("when rate limit is exceeded", () => {
    it("returns 429", async () => {
      vi.mocked(checkRateLimit).mockResolvedValue({ allowed: false, retryAfterMs: 30_000 });
      const res = await GET(makeGetRequest("/api/games/search-igdb", { q: "celeste" }));
      expect(res.status).toBe(429);
    });
  });

  describe("when the search succeeds", () => {
    it("returns the results from the IGDB service", async () => {
      vi.mocked(searchGames).mockResolvedValue([
        { igdbId: 1, name: "Celeste", coverUrl: "https://img/c.jpg" },
      ]);

      const res = await GET(makeGetRequest("/api/games/search-igdb", { q: "celeste" }));

      expect(res.status).toBe(200);
      const body = await parseJson<{
        results: Array<{ igdbId: number; name: string; coverUrl: string | null }>;
      }>(res);
      expect(body.results).toHaveLength(1);
      expect(body.results[0].name).toBe("Celeste");
    });
  });

  describe("when the service throws", () => {
    it("returns 500 with a masked error", async () => {
      vi.mocked(searchGames).mockRejectedValue(new Error("upstream exploded"));

      const res = await GET(makeGetRequest("/api/games/search-igdb", { q: "celeste" }));

      expect(res.status).toBe(500);
      const body = await parseJson<{ error: string }>(res);
      expect(body.error).toBe("Something went wrong. Please try again.");
      expect(body.error).not.toMatch(/upstream/);
    });
  });
});
