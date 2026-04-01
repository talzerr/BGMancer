import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

const mockGetAuthUserId = vi.fn();

vi.mock("@/lib/services/auth-helpers", () => ({
  getAuthUserId: () => mockGetAuthUserId(),
}));

const { withRequiredAuth, withOptionalAuth } = await import("../route-wrappers");

beforeEach(() => {
  mockGetAuthUserId.mockReset();
});

function dummyRequest(): Request {
  return new Request("http://localhost/test");
}

describe("withRequiredAuth", () => {
  describe("when user is authenticated", () => {
    it("should call handler with userId", async () => {
      mockGetAuthUserId.mockResolvedValue("user-1");
      const handler = vi.fn().mockResolvedValue(NextResponse.json({ ok: true }));

      const wrapped = withRequiredAuth(handler, "TEST");
      const res = await wrapped(dummyRequest());

      expect(res.status).toBe(200);
      expect(handler).toHaveBeenCalledWith("user-1", expect.any(Request));
    });
  });

  describe("when user is not authenticated", () => {
    it("should return 401", async () => {
      mockGetAuthUserId.mockResolvedValue(null);
      const handler = vi.fn();

      const wrapped = withRequiredAuth(handler, "TEST");
      const res = await wrapped(dummyRequest());

      expect(res.status).toBe(401);
      expect(handler).not.toHaveBeenCalled();
      const body = await res.json();
      expect(body.error).toBe("Authentication required");
    });
  });

  describe("when handler throws", () => {
    it("should return 500", async () => {
      mockGetAuthUserId.mockResolvedValue("user-1");
      const handler = vi.fn().mockRejectedValue(new Error("boom"));

      const wrapped = withRequiredAuth(handler, "TEST");
      const res = await wrapped(dummyRequest());

      expect(res.status).toBe(500);
      const body = await res.json();
      expect(body.error).toBe("Internal server error");
    });
  });
});

describe("withOptionalAuth", () => {
  describe("when user is authenticated", () => {
    it("should call handler with userId", async () => {
      mockGetAuthUserId.mockResolvedValue("user-1");
      const handler = vi.fn().mockResolvedValue(NextResponse.json({ data: "ok" }));

      const wrapped = withOptionalAuth(handler, "TEST");
      const res = await wrapped(dummyRequest());

      expect(res.status).toBe(200);
      expect(handler).toHaveBeenCalledWith("user-1", expect.any(Request));
    });
  });

  describe("when user is not authenticated", () => {
    it("should call handler with null", async () => {
      mockGetAuthUserId.mockResolvedValue(null);
      const handler = vi.fn().mockResolvedValue(NextResponse.json([]));

      const wrapped = withOptionalAuth(handler, "TEST");
      const res = await wrapped(dummyRequest());

      expect(res.status).toBe(200);
      expect(handler).toHaveBeenCalledWith(null, expect.any(Request));
    });
  });

  describe("when handler throws", () => {
    it("should return 500", async () => {
      mockGetAuthUserId.mockResolvedValue(null);
      const handler = vi.fn().mockRejectedValue(new Error("boom"));

      const wrapped = withOptionalAuth(handler, "TEST");
      const res = await wrapped(dummyRequest());

      expect(res.status).toBe(500);
      const body = await res.json();
      expect(body.error).toBe("Internal server error");
    });
  });
});
