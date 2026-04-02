import { describe, it, expect, vi, beforeEach } from "vitest";

let mockIsDev = false;
let mockSecretKey: string | undefined = "test-secret";

vi.mock("@/lib/env", () => ({
  env: new Proxy(
    {},
    {
      get(_target, prop) {
        if (prop === "isDev") return mockIsDev;
        if (prop === "turnstileSecretKey") return mockSecretKey;
        return undefined;
      },
    },
  ),
}));

const fetchSpy = vi.fn();
vi.stubGlobal("fetch", fetchSpy);

const { verifyTurnstileToken } = await import("../turnstile");

beforeEach(() => {
  mockIsDev = false;
  mockSecretKey = "test-secret";
  fetchSpy.mockReset();
});

describe("verifyTurnstileToken", () => {
  describe("in dev mode", () => {
    it("should skip verification and return success", async () => {
      mockIsDev = true;
      const result = await verifyTurnstileToken("any-token");
      expect(result).toEqual({ success: true });
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });

  describe("when secret key is not configured", () => {
    it("should skip verification and return success", async () => {
      mockSecretKey = undefined;
      const result = await verifyTurnstileToken("any-token");
      expect(result).toEqual({ success: true });
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });

  describe("when token is empty", () => {
    it("should return failure without calling API", async () => {
      const result = await verifyTurnstileToken("");
      expect(result.success).toBe(false);
      expect(result.error).toContain("Bot verification required");
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });

  describe("when verification succeeds", () => {
    it("should return success", async () => {
      fetchSpy.mockResolvedValue({
        json: () => Promise.resolve({ success: true }),
      });

      const result = await verifyTurnstileToken("valid-token", "1.2.3.4");
      expect(result).toEqual({ success: true });
      expect(fetchSpy).toHaveBeenCalledOnce();

      const [url, opts] = fetchSpy.mock.calls[0];
      expect(url).toBe("https://challenges.cloudflare.com/turnstile/v0/siteverify");
      expect(opts.method).toBe("POST");

      const body = new URLSearchParams(opts.body);
      expect(body.get("secret")).toBe("test-secret");
      expect(body.get("response")).toBe("valid-token");
      expect(body.get("remoteip")).toBe("1.2.3.4");
    });

    it("should omit remoteip when not provided", async () => {
      fetchSpy.mockResolvedValue({
        json: () => Promise.resolve({ success: true }),
      });

      await verifyTurnstileToken("valid-token");
      const body = new URLSearchParams(fetchSpy.mock.calls[0][1].body);
      expect(body.has("remoteip")).toBe(false);
    });
  });

  describe("when verification fails", () => {
    it("should return failure with error message", async () => {
      fetchSpy.mockResolvedValue({
        json: () => Promise.resolve({ success: false, "error-codes": ["invalid-input-response"] }),
      });

      const result = await verifyTurnstileToken("bad-token");
      expect(result.success).toBe(false);
      expect(result.error).toContain("Bot verification failed");
    });
  });

  describe("when the siteverify API is unreachable", () => {
    it("should fail open and return success", async () => {
      fetchSpy.mockRejectedValue(new Error("network error"));

      const result = await verifyTurnstileToken("some-token");
      expect(result).toEqual({ success: true });
    });
  });
});
