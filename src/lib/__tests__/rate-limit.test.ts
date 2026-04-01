import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { checkRateLimit, getClientIp } from "../rate-limit";

describe("checkRateLimit", () => {
  beforeEach(() => {
    // Use a unique key prefix per test to avoid cross-test interference
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("when under the limit", () => {
    it("should allow requests", () => {
      const result = checkRateLimit("test-under", 3, 60_000);
      expect(result.allowed).toBe(true);
    });

    it("should allow up to maxRequests", () => {
      for (let i = 0; i < 3; i++) {
        expect(checkRateLimit("test-max", 3, 60_000).allowed).toBe(true);
      }
    });
  });

  describe("when at the limit", () => {
    it("should reject the next request", () => {
      for (let i = 0; i < 3; i++) {
        checkRateLimit("test-reject", 3, 60_000);
      }
      const result = checkRateLimit("test-reject", 3, 60_000);
      expect(result.allowed).toBe(false);
      if (!result.allowed) {
        expect(result.retryAfterMs).toBeGreaterThan(0);
        expect(result.retryAfterMs).toBeLessThanOrEqual(60_000);
      }
    });
  });

  describe("when the window expires", () => {
    it("should allow requests again", () => {
      for (let i = 0; i < 3; i++) {
        checkRateLimit("test-expire", 3, 60_000);
      }
      expect(checkRateLimit("test-expire", 3, 60_000).allowed).toBe(false);

      // Advance past the window
      vi.advanceTimersByTime(60_001);

      expect(checkRateLimit("test-expire", 3, 60_000).allowed).toBe(true);
    });
  });

  describe("with different keys", () => {
    it("should track independently", () => {
      for (let i = 0; i < 3; i++) {
        checkRateLimit("key-a", 3, 60_000);
      }
      expect(checkRateLimit("key-a", 3, 60_000).allowed).toBe(false);
      expect(checkRateLimit("key-b", 3, 60_000).allowed).toBe(true);
    });
  });
});

describe("getClientIp", () => {
  function makeRequest(headers: Record<string, string>): Request {
    return new Request("http://localhost/test", { headers });
  }

  it("should prefer cf-connecting-ip", () => {
    expect(
      getClientIp(
        makeRequest({
          "cf-connecting-ip": "1.2.3.4",
          "x-forwarded-for": "5.6.7.8",
        }),
      ),
    ).toBe("1.2.3.4");
  });

  it("should fall back to x-forwarded-for", () => {
    expect(getClientIp(makeRequest({ "x-forwarded-for": "10.0.0.1, 10.0.0.2" }))).toBe("10.0.0.1");
  });

  it("should fall back to x-real-ip", () => {
    expect(getClientIp(makeRequest({ "x-real-ip": "192.168.1.1" }))).toBe("192.168.1.1");
  });

  it("should return 'unknown' when no headers present", () => {
    expect(getClientIp(makeRequest({}))).toBe("unknown");
  });
});
