import { describe, it, expect, vi, beforeEach } from "vitest";

const mockCreate = vi.fn();

vi.mock("@anthropic-ai/sdk", () => {
  return {
    default: class MockAnthropic {
      messages = { create: mockCreate };
    },
  };
});

const { AnthropicProvider } = await import("../anthropic");

beforeEach(() => {
  mockCreate.mockReset();
});

describe("AnthropicProvider", () => {
  describe("when the API returns a valid text response", () => {
    beforeEach(() => {
      mockCreate.mockResolvedValue({
        content: [{ type: "text", text: "  Hello world  " }],
        stop_reason: "end_turn",
      });
    });

    it("should return the trimmed text", async () => {
      const provider = new AnthropicProvider();
      const result = await provider.complete("system", "user");
      expect(result).toBe("Hello world");
    });

    it("should pass system prompt and user message to the SDK", async () => {
      const provider = new AnthropicProvider();
      await provider.complete("Be helpful", "What is 2+2?");
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          system: "Be helpful",
          messages: [{ role: "user", content: "What is 2+2?" }],
        }),
        undefined,
      );
    });

    it("should use the default model when none specified", async () => {
      const provider = new AnthropicProvider();
      await provider.complete("s", "u");
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({ model: "claude-haiku-4-5-20251001" }),
        undefined,
      );
    });

    it("should use a custom model when specified", async () => {
      const provider = new AnthropicProvider("claude-sonnet-4-6");
      await provider.complete("s", "u");
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({ model: "claude-sonnet-4-6" }),
        undefined,
      );
    });
  });

  describe("when custom options are provided", () => {
    beforeEach(() => {
      mockCreate.mockResolvedValue({
        content: [{ type: "text", text: "ok" }],
        stop_reason: "end_turn",
      });
    });

    it("should pass temperature and maxTokens", async () => {
      const provider = new AnthropicProvider();
      await provider.complete("s", "u", { temperature: 0.2, maxTokens: 4096 });
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({ temperature: 0.2, max_tokens: 4096 }),
        undefined,
      );
    });

    it("should pass abort signal when provided", async () => {
      const controller = new AbortController();
      const provider = new AnthropicProvider();
      await provider.complete("s", "u", { signal: controller.signal });
      expect(mockCreate).toHaveBeenCalledWith(expect.anything(), { signal: controller.signal });
    });

    it("should use defaults when options are omitted", async () => {
      const provider = new AnthropicProvider();
      await provider.complete("s", "u");
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({ temperature: 0.7, max_tokens: 2048 }),
        undefined,
      );
    });
  });

  describe("when the API returns an empty response", () => {
    it("should throw when content array is empty", async () => {
      mockCreate.mockResolvedValue({ content: [], stop_reason: "end_turn" });
      const provider = new AnthropicProvider();
      await expect(provider.complete("s", "u")).rejects.toThrow("empty response");
    });

    it("should throw when content block is not text type", async () => {
      mockCreate.mockResolvedValue({
        content: [{ type: "tool_use", id: "x" }],
        stop_reason: "end_turn",
      });
      const provider = new AnthropicProvider();
      await expect(provider.complete("s", "u")).rejects.toThrow("empty response");
    });

    it("should throw when text is whitespace-only", async () => {
      mockCreate.mockResolvedValue({
        content: [{ type: "text", text: "   " }],
        stop_reason: "end_turn",
      });
      const provider = new AnthropicProvider();
      await expect(provider.complete("s", "u")).rejects.toThrow("empty response");
    });
  });

  describe("when the SDK throws", () => {
    it("should propagate the error", async () => {
      mockCreate.mockRejectedValue(new Error("API rate limited"));
      const provider = new AnthropicProvider();
      await expect(provider.complete("s", "u")).rejects.toThrow("API rate limited");
    });
  });
});
