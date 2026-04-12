// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type { PlaylistTrack } from "@/types";
import { useSync } from "../useSync";

const signInMock = vi.fn();

vi.mock("next-auth/react", () => ({
  signIn: (...args: unknown[]) => signInMock(...args),
}));

function makeTrack(id: string): PlaylistTrack {
  return {
    id,
    playlist_id: "session-1",
    game_id: "game-1",
    track_name: null,
    video_id: `vid-${id}`,
    video_title: null,
    channel_title: null,
    thumbnail: null,
    duration_seconds: 0,
    position: 0,
    created_at: "2026-04-11T00:00:00Z",
  };
}

const defaultArgs = {
  currentSessionId: "session-1" as string | null,
  tracks: [makeTrack("a"), makeTrack("b")],
  initialYoutubePlaylistId: null as string | null,
};

beforeEach(() => {
  signInMock.mockReset();
  Object.defineProperty(window, "location", {
    writable: true,
    value: { pathname: "/" },
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useSync", () => {
  describe("initial state", () => {
    it("starts idle when there is no initial YouTube playlist ID", () => {
      const { result } = renderHook(() => useSync(defaultArgs));
      expect(result.current.status).toBe("idle");
      expect(result.current.playlistUrl).toBeNull();
      expect(result.current.error).toBeNull();
    });

    it("starts synced with a derived URL when an initial ID is provided", () => {
      const { result } = renderHook(() =>
        useSync({ ...defaultArgs, initialYoutubePlaylistId: "PL_init" }),
      );
      expect(result.current.status).toBe("synced");
      expect(result.current.playlistUrl).toBe("https://www.youtube.com/playlist?list=PL_init");
    });
  });

  describe("sync", () => {
    it("transitions to synced on 200 and returns true", async () => {
      vi.spyOn(global, "fetch").mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            playlistId: "PL_new",
            playlistUrl: "https://www.youtube.com/playlist?list=PL_new",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );

      const { result } = renderHook(() => useSync(defaultArgs));
      let returnValue = false;
      await act(async () => {
        returnValue = await result.current.sync();
      });

      expect(returnValue).toBe(true);
      expect(result.current.status).toBe("synced");
      expect(result.current.playlistUrl).toBe("https://www.youtube.com/playlist?list=PL_new");
      expect(result.current.error).toBeNull();
    });

    it("enters error state on a non-401 failure and returns false", async () => {
      vi.spyOn(global, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "Please wait a few minutes before syncing again." }), {
          status: 429,
          headers: { "Content-Type": "application/json" },
        }),
      );

      const { result } = renderHook(() => useSync(defaultArgs));
      let returnValue = true;
      await act(async () => {
        returnValue = await result.current.sync();
      });

      expect(returnValue).toBe(false);
      expect(result.current.status).toBe("error");
      expect(result.current.error).toBe("Please wait a few minutes before syncing again.");
    });

    it("falls back to a default message when the error body lacks `error`", async () => {
      vi.spyOn(global, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify({}), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }),
      );

      const { result } = renderHook(() => useSync(defaultArgs));
      await act(async () => {
        await result.current.sync();
      });
      expect(result.current.error).toBe("Couldn't create playlist. Try again.");
    });

    it("triggers incremental signIn with the YouTube scope on 401", async () => {
      vi.spyOn(global, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "..." }), { status: 401 }),
      );

      const { result } = renderHook(() => useSync(defaultArgs));
      await act(async () => {
        const ok = await result.current.sync();
        expect(ok).toBe(false);
      });

      expect(signInMock).toHaveBeenCalledWith(
        "google",
        expect.objectContaining({ callbackUrl: expect.any(String) }),
        expect.objectContaining({ scope: expect.stringContaining("youtube") }),
      );
    });

    it("enters error state when the network call itself throws", async () => {
      vi.spyOn(global, "fetch").mockRejectedValueOnce(new TypeError("network down"));

      const { result } = renderHook(() => useSync(defaultArgs));
      await act(async () => {
        await result.current.sync();
      });
      expect(result.current.status).toBe("error");
      expect(result.current.error).toBe("Could not reach server. Try again.");
    });

    it("is a no-op when currentSessionId is null", async () => {
      const fetchSpy = vi.spyOn(global, "fetch");
      const { result } = renderHook(() => useSync({ ...defaultArgs, currentSessionId: null }));
      let returnValue = true;
      await act(async () => {
        returnValue = await result.current.sync();
      });
      expect(returnValue).toBe(false);
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });

  describe("reactive resets", () => {
    it("resets to idle when currentSessionId changes after a successful sync", async () => {
      vi.spyOn(global, "fetch").mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            playlistId: "PL_A",
            playlistUrl: "https://www.youtube.com/playlist?list=PL_A",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );

      const { result, rerender } = renderHook((args: typeof defaultArgs) => useSync(args), {
        initialProps: defaultArgs,
      });
      await act(async () => {
        await result.current.sync();
      });
      expect(result.current.status).toBe("synced");

      rerender({ ...defaultArgs, currentSessionId: "session-2" });
      expect(result.current.status).toBe("idle");
      expect(result.current.playlistUrl).toBeNull();
    });

    it("resets to idle when the track fingerprint changes", () => {
      const { result, rerender } = renderHook((args: typeof defaultArgs) => useSync(args), {
        initialProps: { ...defaultArgs, initialYoutubePlaylistId: "PL_start" },
      });
      expect(result.current.status).toBe("synced");

      rerender({ ...defaultArgs, initialYoutubePlaylistId: "PL_start", tracks: [makeTrack("c")] });
      expect(result.current.status).toBe("idle");
    });

    it("leaves an initially-synced state intact when props are unchanged", () => {
      const { result, rerender } = renderHook((args: typeof defaultArgs) => useSync(args), {
        initialProps: { ...defaultArgs, initialYoutubePlaylistId: "PL_stable" },
      });
      expect(result.current.status).toBe("synced");

      rerender({ ...defaultArgs, initialYoutubePlaylistId: "PL_stable" });
      expect(result.current.status).toBe("synced");
    });

    it("restores synced state when switching to a previously-synced session", () => {
      const { result, rerender } = renderHook((args: typeof defaultArgs) => useSync(args), {
        initialProps: defaultArgs,
      });
      expect(result.current.status).toBe("idle");

      rerender({
        ...defaultArgs,
        currentSessionId: "session-2",
        initialYoutubePlaylistId: "PL_existing",
      });
      expect(result.current.status).toBe("synced");
      expect(result.current.playlistUrl).toBe("https://www.youtube.com/playlist?list=PL_existing");
    });
  });

  describe("resetSync", () => {
    it("clears status and error without touching the baseline", async () => {
      vi.spyOn(global, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "Nope." }), { status: 500 }),
      );
      const { result } = renderHook(() => useSync(defaultArgs));
      await act(async () => {
        await result.current.sync();
      });
      expect(result.current.status).toBe("error");

      act(() => {
        result.current.resetSync();
      });
      expect(result.current.status).toBe("idle");
      expect(result.current.error).toBeNull();
    });
  });
});
