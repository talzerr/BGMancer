import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeJsonRequest, parseJson } from "@/test/route-helpers";

vi.mock("@/lib/db/repo", () => ({
  GameRequests: {
    upsertRequest: vi.fn(),
  },
}));

vi.mock("@/lib/services/external/turnstile", () => ({
  verifyTurnstileToken: vi.fn(),
}));

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn(),
  getClientIp: () => "1.2.3.4",
}));

const { GameRequests } = await import("@/lib/db/repo");
const { verifyTurnstileToken } = await import("@/lib/services/external/turnstile");
const { checkRateLimit } = await import("@/lib/rate-limit");
const { POST } = await import("../route");

const validBody = {
  igdbId: 123,
  name: "Celeste",
  coverUrl: "https://img/c.jpg",
  turnstileToken: "tok-xyz",
};

beforeEach(() => {
  vi.mocked(GameRequests.upsertRequest).mockReset();
  vi.mocked(verifyTurnstileToken).mockReset();
  vi.mocked(checkRateLimit).mockReset();
  vi.mocked(verifyTurnstileToken).mockResolvedValue({ success: true });
  vi.mocked(checkRateLimit).mockResolvedValue({ allowed: true });
  vi.mocked(GameRequests.upsertRequest).mockResolvedValue({
    igdbId: 123,
    name: "Celeste",
    coverUrl: "https://img/c.jpg",
    requestCount: 1,
    acknowledged: false,
    createdAt: "2026-04-08T12:00:00Z",
    updatedAt: "2026-04-08T12:00:00Z",
  });
});

describe("POST /api/games/request", () => {
  describe("when the body is not JSON", () => {
    it("returns 400", async () => {
      const req = new Request("http://localhost:6959/api/games/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "not-json",
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });
  });

  describe("when the body is missing required fields", () => {
    it("returns 400", async () => {
      const res = await POST(makeJsonRequest("/api/games/request", "POST", { igdbId: 1 }));
      expect(res.status).toBe(400);
    });
  });

  describe("when Turnstile verification fails", () => {
    it("returns 403 and does not touch the repo", async () => {
      vi.mocked(verifyTurnstileToken).mockResolvedValue({
        success: false,
        error: "Bot verification failed. Please try again.",
      });

      const res = await POST(makeJsonRequest("/api/games/request", "POST", validBody));

      expect(res.status).toBe(403);
      expect(GameRequests.upsertRequest).not.toHaveBeenCalled();
    });
  });

  describe("when the rate limit is exceeded", () => {
    it("returns 429 before paying for turnstile or DB", async () => {
      vi.mocked(checkRateLimit).mockResolvedValue({
        allowed: false,
        retryAfterMs: 60_000,
      });

      const res = await POST(makeJsonRequest("/api/games/request", "POST", validBody));

      expect(res.status).toBe(429);
      expect(verifyTurnstileToken).not.toHaveBeenCalled();
      expect(GameRequests.upsertRequest).not.toHaveBeenCalled();
    });
  });

  describe("when the request is valid", () => {
    it("calls upsertRequest and returns { success: true }", async () => {
      const res = await POST(makeJsonRequest("/api/games/request", "POST", validBody));

      expect(res.status).toBe(200);
      const body = await parseJson<{ success: boolean }>(res);
      expect(body.success).toBe(true);
      expect(GameRequests.upsertRequest).toHaveBeenCalledWith(123, "Celeste", "https://img/c.jpg");
    });
  });

  describe("when the repo throws", () => {
    it("returns 500 with a masked error", async () => {
      vi.mocked(GameRequests.upsertRequest).mockRejectedValue(new Error("db exploded"));

      const res = await POST(makeJsonRequest("/api/games/request", "POST", validBody));

      expect(res.status).toBe(500);
      const body = await parseJson<{ error: string }>(res);
      expect(body.error).toBe("Something went wrong. Please try again.");
      expect(body.error).not.toMatch(/db exploded/);
    });
  });
});
