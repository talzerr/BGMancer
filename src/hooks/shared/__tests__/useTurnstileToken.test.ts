// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useTurnstileToken } from "../useTurnstileToken";

interface MockTurnstile {
  render: ReturnType<typeof vi.fn>;
}

afterEach(() => {
  delete (window as unknown as { turnstile?: MockTurnstile }).turnstile;
  vi.useRealTimers();
});

function installTurnstileMock(): MockTurnstile {
  const mock: MockTurnstile = {
    render: vi.fn((_container, opts: { callback: (t: string) => void }) => {
      opts.callback("real-token");
    }),
  };
  (window as unknown as { turnstile: MockTurnstile }).turnstile = mock;
  return mock;
}

describe("useTurnstileToken", () => {
  describe("when no site key is provided", () => {
    it("returns an empty token without touching the widget", async () => {
      const { result } = renderHook(() => useTurnstileToken(undefined));

      const token = await result.current.getToken();
      expect(token).toBe("");
    });
  });

  describe("when the script is ready before getToken is called", () => {
    it("renders the widget and resolves the callback token", async () => {
      installTurnstileMock();
      const { result } = renderHook(() => useTurnstileToken("site-key"));

      // Attach a div to satisfy the container ref check.
      const div = document.createElement("div");
      result.current.containerRef.current = div;

      act(() => {
        result.current.scriptOnReady();
      });

      const token = await result.current.getToken();
      expect(token).toBe("real-token");
    });
  });

  describe("when the script never loads", () => {
    it("times out after the deadline and returns an empty token", async () => {
      vi.useFakeTimers();
      const { result } = renderHook(() => useTurnstileToken("site-key"));

      // No turnstile mock installed, no scriptOnReady call.
      const tokenPromise = result.current.getToken();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(5000);
      });

      const token = await tokenPromise;
      expect(token).toBe("");
    });
  });

  describe("when the widget callback fires an error", () => {
    it("resolves with empty string", async () => {
      const mock: MockTurnstile = {
        render: vi.fn((_container, opts: { "error-callback": () => void }) => {
          opts["error-callback"]();
        }),
      };
      (window as unknown as { turnstile: MockTurnstile }).turnstile = mock;

      const { result } = renderHook(() => useTurnstileToken("site-key"));
      const div = document.createElement("div");
      result.current.containerRef.current = div;

      act(() => result.current.scriptOnReady());

      const token = await result.current.getToken();
      expect(token).toBe("");
    });
  });
});
