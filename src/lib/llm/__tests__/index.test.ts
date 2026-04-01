import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { _reloadEnvForTest } from "@/lib/env";

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
  _reloadEnvForTest();
});

describe("getTaggingProvider", () => {
  describe("when ANTHROPIC_API_KEY is set", () => {
    beforeEach(() => {
      process.env.ANTHROPIC_API_KEY = "test-key";
      _reloadEnvForTest();
    });

    it("should return a provider", () => {
      const provider = getTaggingProvider();
      expect(provider).toBeDefined();
      expect(provider.complete).toBeDefined();
    });

    it("should use ANTHROPIC_TAGGING_MODEL when set", () => {
      process.env.ANTHROPIC_TAGGING_MODEL = "claude-sonnet-4-6";
      _reloadEnvForTest();
      getTaggingProvider();
      expect(mockConstructor).toHaveBeenCalledWith("claude-sonnet-4-6");
    });

    it("should fall back to ANTHROPIC_MODEL when tagging model is not set", () => {
      (process.env as Record<string, string | undefined>).ANTHROPIC_TAGGING_MODEL = undefined;
      process.env.ANTHROPIC_MODEL = "claude-opus-4-6";
      _reloadEnvForTest();
      getTaggingProvider();
      expect(mockConstructor).toHaveBeenCalledWith("claude-opus-4-6");
    });

    it("should use default model when no model env vars are set", () => {
      (process.env as Record<string, string | undefined>).ANTHROPIC_TAGGING_MODEL = undefined;
      (process.env as Record<string, string | undefined>).ANTHROPIC_MODEL = undefined;
      _reloadEnvForTest();
      getTaggingProvider();
      expect(mockConstructor).toHaveBeenCalledWith();
    });
  });

  describe("when ANTHROPIC_API_KEY is not set", () => {
    beforeEach(() => {
      (process.env as Record<string, string | undefined>).ANTHROPIC_API_KEY = undefined;
      _reloadEnvForTest();
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
      _reloadEnvForTest();
    });

    it("should return a provider", () => {
      expect(getVibeProfilerProvider()).toBeDefined();
    });

    it("should use ANTHROPIC_VIBE_MODEL when set", () => {
      process.env.ANTHROPIC_VIBE_MODEL = "claude-sonnet-4-6";
      _reloadEnvForTest();
      getVibeProfilerProvider();
      expect(mockConstructor).toHaveBeenCalledWith("claude-sonnet-4-6");
    });
  });

  describe("when ANTHROPIC_API_KEY is not set", () => {
    beforeEach(() => {
      (process.env as Record<string, string | undefined>).ANTHROPIC_API_KEY = undefined;
      _reloadEnvForTest();
    });

    it("should throw", () => {
      expect(() => getVibeProfilerProvider()).toThrow("ANTHROPIC_API_KEY is required");
    });
  });
});
