import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockConstructor = vi.fn();

vi.mock("../anthropic", () => ({
  AnthropicProvider: class MockProvider {
    complete = vi.fn().mockResolvedValue("mocked");
    constructor(...args: unknown[]) {
      mockConstructor(...args);
    }
  },
}));

const { getTaggingProvider, getVibeProfilerProvider } = await import("../index");

const originalEnv = { ...process.env };

beforeEach(() => {
  mockConstructor.mockClear();
});

afterEach(() => {
  process.env = { ...originalEnv };
});

describe("getTaggingProvider", () => {
  describe("when ANTHROPIC_API_KEY is set", () => {
    beforeEach(() => {
      process.env.ANTHROPIC_API_KEY = "test-key";
    });

    it("should return a provider", () => {
      const provider = getTaggingProvider();
      expect(provider).toBeDefined();
      expect(provider.complete).toBeDefined();
    });

    it("should use ANTHROPIC_TAGGING_MODEL when set", () => {
      process.env.ANTHROPIC_TAGGING_MODEL = "claude-sonnet-4-6";
      getTaggingProvider();
      expect(mockConstructor).toHaveBeenCalledWith("claude-sonnet-4-6");
    });

    it("should fall back to ANTHROPIC_MODEL when tagging model is not set", () => {
      delete process.env.ANTHROPIC_TAGGING_MODEL;
      process.env.ANTHROPIC_MODEL = "claude-opus-4-6";
      getTaggingProvider();
      expect(mockConstructor).toHaveBeenCalledWith("claude-opus-4-6");
    });

    it("should use default model when no model env vars are set", () => {
      delete process.env.ANTHROPIC_TAGGING_MODEL;
      delete process.env.ANTHROPIC_MODEL;
      getTaggingProvider();
      expect(mockConstructor).toHaveBeenCalledWith();
    });
  });

  describe("when ANTHROPIC_API_KEY is not set", () => {
    beforeEach(() => {
      delete process.env.ANTHROPIC_API_KEY;
    });

    it("should throw", () => {
      expect(() => getTaggingProvider()).toThrow("ANTHROPIC_API_KEY is required");
    });
  });
});

describe("getVibeProfilerProvider", () => {
  describe("when ANTHROPIC_API_KEY is set", () => {
    beforeEach(() => {
      process.env.ANTHROPIC_API_KEY = "test-key";
    });

    it("should return a provider", () => {
      expect(getVibeProfilerProvider()).toBeDefined();
    });

    it("should use ANTHROPIC_VIBE_MODEL when set", () => {
      process.env.ANTHROPIC_VIBE_MODEL = "claude-sonnet-4-6";
      getVibeProfilerProvider();
      expect(mockConstructor).toHaveBeenCalledWith("claude-sonnet-4-6");
    });
  });

  describe("when ANTHROPIC_API_KEY is not set", () => {
    beforeEach(() => {
      delete process.env.ANTHROPIC_API_KEY;
    });

    it("should throw", () => {
      expect(() => getVibeProfilerProvider()).toThrow("ANTHROPIC_API_KEY is required");
    });
  });
});
