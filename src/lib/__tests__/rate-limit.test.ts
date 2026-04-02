import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  checkRateLimit,
  getClientIp,
  checkGuestRateLimit,
  acquireUserGeneration,
} from "../rate-limit";

describe("checkRateLimit", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("when under the limit", () => {
    it("should allow requests", async () => {
      const result = await checkRateLimit("test-under", 3, 60_000);
      expect(result.allowed).toBe(true);
    });

    it("should allow up to maxRequests", async () => {
      for (let i = 0; i < 3; i++) {
        expect((await checkRateLimit("test-max", 3, 60_000)).allowed).toBe(true);
      }
    });
  });

  describe("when at the limit", () => {
    it("should reject the next request", async () => {
      for (let i = 0; i < 3; i++) {
        await checkRateLimit("test-reject", 3, 60_000);
      }
      const result = await checkRateLimit("test-reject", 3, 60_000);
      expect(result.allowed).toBe(false);
      if (!result.allowed) {
        expect(result.retryAfterMs).toBeGreaterThan(0);
        expect(result.retryAfterMs).toBeLessThanOrEqual(60_000);
      }
    });
  });

  describe("when the window expires", () => {
    it("should allow requests again", async () => {
      for (let i = 0; i < 3; i++) {
        await checkRateLimit("test-expire", 3, 60_000);
      }
      expect((await checkRateLimit("test-expire", 3, 60_000)).allowed).toBe(false);

      // Advance past the window
      vi.advanceTimersByTime(60_001);

      expect((await checkRateLimit("test-expire", 3, 60_000)).allowed).toBe(true);
    });
  });

  describe("with different keys", () => {
    it("should track independently", async () => {
      for (let i = 0; i < 3; i++) {
        await checkRateLimit("key-a", 3, 60_000);
      }
      expect((await checkRateLimit("key-a", 3, 60_000)).allowed).toBe(false);
      expect((await checkRateLimit("key-b", 3, 60_000)).allowed).toBe(true);
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

describe("checkGuestRateLimit", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function makeGuestRequest(ip: string): Request {
    return new Request("http://localhost/test", {
      headers: { "x-real-ip": ip },
    });
  }

  it("should allow requests under the limit", async () => {
    expect(await checkGuestRateLimit(makeGuestRequest("guest-1"))).toBeNull();
  });

  it("should share the bucket across all routes for the same IP", async () => {
    for (let i = 0; i < 10; i++) {
      await checkGuestRateLimit(makeGuestRequest("guest-shared"));
    }
    const result = await checkGuestRateLimit(makeGuestRequest("guest-shared"));
    expect(result).not.toBeNull();
    expect(result!.waitSec).toBeGreaterThan(0);
  });
});

describe("acquireUserGeneration", () => {
  it("should allow and increment when under the cap", async () => {
    expect(await acquireUserGeneration("user-acq-1")).toBeNull();
    expect(await acquireUserGeneration("user-acq-1")).toBeNull();
  });

  it("should reject when at the cap", async () => {
    const userId = "user-acq-2";
    for (let i = 0; i < 10; i++) {
      expect(await acquireUserGeneration(userId)).toBeNull();
    }
    const result = await acquireUserGeneration(userId);
    expect(result).not.toBeNull();
    expect(result!.error).toContain("Daily generation limit");
  });

  it("should allow exactly up to the cap", async () => {
    const userId = "user-acq-3";
    for (let i = 0; i < 9; i++) {
      await acquireUserGeneration(userId);
    }
    expect(await acquireUserGeneration(userId)).toBeNull(); // 10th — allowed
    expect(await acquireUserGeneration(userId)).not.toBeNull(); // 11th — rejected
  });
});
