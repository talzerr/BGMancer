import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeGetRequest, makeJsonRequest, parseJson } from "@/test/route-helpers";
import type { GameRequest } from "@/lib/db/repo";

vi.mock("@/lib/db/repo", () => ({
  GameRequests: {
    getAll: vi.fn(),
    getUnacknowledged: vi.fn(),
    acknowledge: vi.fn(),
  },
}));

const { GameRequests } = await import("@/lib/db/repo");
const { GET } = await import("../route");
const { POST } = await import("../acknowledge/route");

const sample: GameRequest = {
  igdbId: 1,
  name: "Celeste",
  coverUrl: null,
  requestCount: 3,
  acknowledged: false,
  createdAt: "2026-04-08T12:00:00Z",
  updatedAt: "2026-04-08T12:00:00Z",
};

beforeEach(() => {
  vi.mocked(GameRequests.getAll).mockReset();
  vi.mocked(GameRequests.getUnacknowledged).mockReset();
  vi.mocked(GameRequests.acknowledge).mockReset();
});

describe("GET /api/backstage/requests", () => {
  describe("when no query param is set", () => {
    it("defaults to unacknowledged-only", async () => {
      vi.mocked(GameRequests.getUnacknowledged).mockResolvedValue([sample]);

      const res = await GET(makeGetRequest("/api/backstage/requests"));

      expect(res.status).toBe(200);
      expect(GameRequests.getUnacknowledged).toHaveBeenCalledOnce();
      expect(GameRequests.getAll).not.toHaveBeenCalled();
      const body = await parseJson<{ requests: GameRequest[] }>(res);
      expect(body.requests).toHaveLength(1);
    });
  });

  describe("when all=1 is set", () => {
    it("calls getAll", async () => {
      vi.mocked(GameRequests.getAll).mockResolvedValue([sample]);

      const res = await GET(makeGetRequest("/api/backstage/requests", { all: "1" }));

      expect(res.status).toBe(200);
      expect(GameRequests.getAll).toHaveBeenCalledOnce();
      expect(GameRequests.getUnacknowledged).not.toHaveBeenCalled();
    });
  });

  describe("when all has any other value", () => {
    it("falls back to unacknowledged-only", async () => {
      vi.mocked(GameRequests.getUnacknowledged).mockResolvedValue([sample]);

      const res = await GET(makeGetRequest("/api/backstage/requests", { all: "true" }));

      expect(res.status).toBe(200);
      expect(GameRequests.getUnacknowledged).toHaveBeenCalledOnce();
      expect(GameRequests.getAll).not.toHaveBeenCalled();
    });
  });

  describe("when the repo throws", () => {
    it("returns 500 with a masked error", async () => {
      vi.mocked(GameRequests.getUnacknowledged).mockRejectedValue(new Error("boom"));

      const res = await GET(makeGetRequest("/api/backstage/requests"));

      expect(res.status).toBe(500);
      const body = await parseJson<{ error: string }>(res);
      expect(body.error).toBe("Failed to load requests");
    });
  });
});

describe("POST /api/backstage/requests/acknowledge", () => {
  describe("when the body is missing igdbId", () => {
    it("returns 400", async () => {
      const res = await POST(makeJsonRequest("/api/backstage/requests/acknowledge", "POST", {}));
      expect(res.status).toBe(400);
    });
  });

  describe("when igdbId is valid", () => {
    it("calls GameRequests.acknowledge", async () => {
      vi.mocked(GameRequests.acknowledge).mockResolvedValue();

      const res = await POST(
        makeJsonRequest("/api/backstage/requests/acknowledge", "POST", { igdbId: 42 }),
      );

      expect(res.status).toBe(200);
      expect(GameRequests.acknowledge).toHaveBeenCalledWith(42);
    });
  });

  describe("when the repo throws", () => {
    it("returns 500 with a masked error", async () => {
      vi.mocked(GameRequests.acknowledge).mockRejectedValue(new Error("boom"));

      const res = await POST(
        makeJsonRequest("/api/backstage/requests/acknowledge", "POST", { igdbId: 42 }),
      );

      expect(res.status).toBe(500);
    });
  });
});
