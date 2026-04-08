// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useGameRequest } from "../useGameRequest";

// ─── Fetch mock plumbing ────────────────────────────────────────────────────

type FetchHandler = (url: string, init?: RequestInit) => Promise<Response>;
const originalFetch = global.fetch;

function mockFetch(handler: FetchHandler) {
  global.fetch = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    return handler(url, init);
  }) as typeof fetch;
}

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: "OK",
    json: async () => body,
    text: async () => JSON.stringify(body),
    headers: new Headers(),
    url: "",
  } as unknown as Response;
}

afterEach(() => {
  global.fetch = originalFetch;
});

const sampleResults = [
  { igdbId: 1, name: "Celeste", coverUrl: "https://img/c.jpg" },
  { igdbId: 2, name: "Hollow Knight", coverUrl: null },
];

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("useGameRequest", () => {
  describe("when disabled", () => {
    it("does not fire any fetches and exposes empty state", async () => {
      mockFetch(async () => jsonResponse({ results: [] }));
      const { result } = renderHook(() =>
        useGameRequest({ catalogSearch: "celeste", enabled: false }),
      );

      act(() => result.current.activate());
      await new Promise((r) => setTimeout(r, 350));

      expect(global.fetch).not.toHaveBeenCalled();
      expect(result.current.results).toBeNull();
    });
  });

  describe("when enabled and the user activates", () => {
    beforeEach(() => {
      mockFetch(async (url) => {
        if (url.startsWith("/api/games/search-igdb")) {
          return jsonResponse({ results: sampleResults });
        }
        return jsonResponse({ error: "unexpected" }, 500);
      });
    });

    it("debounces and fetches IGDB results, exposing them on the hook", async () => {
      const { result } = renderHook(() =>
        useGameRequest({ catalogSearch: "celeste", enabled: true }),
      );

      act(() => result.current.activate());

      await waitFor(() => expect(result.current.results).not.toBeNull());

      expect(result.current.results).toEqual(sampleResults);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
    });
  });

  describe("when search-igdb returns 404", () => {
    it("flips into degraded mode and stops querying", async () => {
      mockFetch(async () => jsonResponse({ error: "Not found" }, 404));
      const { result } = renderHook(() =>
        useGameRequest({ catalogSearch: "celeste", enabled: true }),
      );

      act(() => result.current.activate());
      await waitFor(() => expect(result.current.degraded).toBe(true));
    });
  });

  describe("when search-igdb returns 5xx", () => {
    it("sets a user-facing error", async () => {
      mockFetch(async () => jsonResponse({ error: "boom" }, 500));
      const { result } = renderHook(() =>
        useGameRequest({ catalogSearch: "celeste", enabled: true }),
      );

      act(() => result.current.activate());
      await waitFor(() => expect(result.current.error).toBe("Couldn't search. Try again."));
    });
  });

  describe("submitRequest", () => {
    it("posts the chosen result and switches to the submitted state", async () => {
      let postBody: unknown;
      mockFetch(async (url, init) => {
        if (url.startsWith("/api/games/search-igdb")) {
          return jsonResponse({ results: sampleResults });
        }
        if (url === "/api/games/request") {
          postBody = JSON.parse(init!.body as string);
          return jsonResponse({ success: true });
        }
        return jsonResponse({ error: "unexpected" }, 500);
      });

      const { result } = renderHook(() =>
        useGameRequest({ catalogSearch: "celeste", enabled: true }),
      );

      act(() => result.current.activate());
      await waitFor(() => expect(result.current.results).not.toBeNull());

      await act(async () => {
        await result.current.submitRequest(sampleResults[0], "tok-xyz");
      });

      expect(result.current.submittedName).toBe("Celeste");
      expect(postBody).toEqual({
        igdbId: 1,
        name: "Celeste",
        coverUrl: "https://img/c.jpg",
        turnstileToken: "tok-xyz",
      });
    });

    it("surfaces server error messages on failure", async () => {
      mockFetch(async (url) => {
        if (url.startsWith("/api/games/search-igdb")) {
          return jsonResponse({ results: sampleResults });
        }
        return jsonResponse({ error: "Bot verification failed. Please try again." }, 403);
      });

      const { result } = renderHook(() =>
        useGameRequest({ catalogSearch: "celeste", enabled: true }),
      );
      act(() => result.current.activate());
      await waitFor(() => expect(result.current.results).not.toBeNull());

      await act(async () => {
        await result.current.submitRequest(sampleResults[0], "");
      });

      expect(result.current.error).toBe("Bot verification failed. Please try again.");
      expect(result.current.submittedName).toBeNull();
    });
  });

  describe("when catalogSearch changes", () => {
    it("resets all internal state", async () => {
      mockFetch(async () => jsonResponse({ results: sampleResults }));
      const { result, rerender } = renderHook(
        ({ catalogSearch }) => useGameRequest({ catalogSearch, enabled: true }),
        { initialProps: { catalogSearch: "celeste" } },
      );

      act(() => result.current.activate());
      await waitFor(() => expect(result.current.results).not.toBeNull());

      rerender({ catalogSearch: "hollow knight" });

      expect(result.current.results).toBeNull();
      expect(result.current.activated).toBe(false);
      expect(result.current.query).toBe("");
    });
  });
});
