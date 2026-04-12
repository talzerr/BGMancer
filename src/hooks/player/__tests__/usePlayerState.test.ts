// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { usePlayerState } from "../usePlayerState";
import type { PlaylistTrack } from "@/types";
import {
  TEST_PLAYLIST_ID,
  TEST_GAME_ID,
  TEST_GAME_TITLE,
  TEST_TRACK_NAME,
  TEST_VIDEO_ID,
  TEST_VIDEO_TITLE,
  TEST_CHANNEL_TITLE,
  TEST_THUMBNAIL_URL,
  TEST_DURATION_SECONDS,
} from "@/test/constants";

function makeTrack(id: string, overrides: Partial<PlaylistTrack> = {}): PlaylistTrack {
  return {
    id,
    playlist_id: TEST_PLAYLIST_ID,
    game_id: TEST_GAME_ID,
    game_title: TEST_GAME_TITLE,
    track_name: TEST_TRACK_NAME,
    video_id: TEST_VIDEO_ID,
    video_title: TEST_VIDEO_TITLE,
    channel_title: TEST_CHANNEL_TITLE,
    thumbnail: TEST_THUMBNAIL_URL,
    duration_seconds: TEST_DURATION_SECONDS,
    position: 0,
    created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("usePlayerState", () => {
  describe("initial state", () => {
    it("should start with no track playing", () => {
      const { result } = renderHook(() => usePlayerState());
      expect(result.current.currentTrackIndex).toBeNull();
      expect(result.current.playingTrackId).toBeNull();
      expect(result.current.playingSessionId).toBeNull();
      expect(result.current.isPlayerPlaying).toBe(false);
      expect(result.current.playingTracks).toEqual([]);
      expect(result.current.playedTrackIds.size).toBe(0);
    });
  });

  describe("startPlaying", () => {
    it("should set playing tracks, index, and session ID", () => {
      const { result } = renderHook(() => usePlayerState());
      const tracks = [makeTrack("t1"), makeTrack("t2"), makeTrack("t3")];

      act(() => {
        result.current.startPlaying(tracks, 1, "session-1");
      });

      expect(result.current.currentTrackIndex).toBe(1);
      expect(result.current.playingTrackId).toBe("t2");
      expect(result.current.playingSessionId).toBe("session-1");
      expect(result.current.playingTracks).toEqual(tracks);
    });

    it("should preserve playedTrackIds across startPlaying calls", () => {
      const { result } = renderHook(() => usePlayerState());
      const tracks = [makeTrack("t1"), makeTrack("t2")];

      act(() => {
        result.current.startPlaying(tracks, 0, "session-1");
      });
      expect(result.current.playedTrackIds.has("t1")).toBe(true);

      act(() => {
        result.current.setCurrentTrackIndex(1);
      });
      expect(result.current.playedTrackIds.has("t2")).toBe(true);

      // Same session: preserves revealed tracks
      act(() => {
        result.current.startPlaying(tracks, 0, "session-1");
      });
      expect(result.current.playedTrackIds.has("t1")).toBe(true);
      expect(result.current.playedTrackIds.has("t2")).toBe(true);

      // Different session: clears revealed tracks
      const newTracks = [makeTrack("t3"), makeTrack("t4")];
      act(() => {
        result.current.startPlaying(newTracks, 0, "session-2");
      });
      expect(result.current.playedTrackIds.has("t1")).toBe(false);
      expect(result.current.playedTrackIds.has("t2")).toBe(false);
    });
  });

  describe("reset", () => {
    it("should clear all player state", () => {
      const { result } = renderHook(() => usePlayerState());
      const tracks = [makeTrack("t1"), makeTrack("t2")];

      act(() => {
        result.current.startPlaying(tracks, 0, "session-1");
      });
      expect(result.current.currentTrackIndex).toBe(0);

      act(() => {
        result.current.reset();
      });

      expect(result.current.currentTrackIndex).toBeNull();
      expect(result.current.playingTrackId).toBeNull();
      expect(result.current.playingSessionId).toBeNull();
      expect(result.current.playingTracks).toEqual([]);
      expect(result.current.playedTrackIds.size).toBe(0);
    });
  });

  describe("playingTrackId", () => {
    it("should derive the playing track ID from the current index", () => {
      const { result } = renderHook(() => usePlayerState());
      const tracks = [makeTrack("t1"), makeTrack("t2")];

      act(() => {
        result.current.startPlaying(tracks, 0, "session-1");
      });
      expect(result.current.playingTrackId).toBe("t1");

      act(() => {
        result.current.setCurrentTrackIndex(1);
      });
      expect(result.current.playingTrackId).toBe("t2");
    });

    it("should return null when no track is playing", () => {
      const { result } = renderHook(() => usePlayerState());
      expect(result.current.playingTrackId).toBeNull();
    });
  });

  describe("activeGameId", () => {
    it("should derive the active game ID from the current track", () => {
      const { result } = renderHook(() => usePlayerState());
      const tracks = [
        makeTrack("t1", { game_id: "game-a" }),
        makeTrack("t2", { game_id: "game-b" }),
      ];

      act(() => {
        result.current.startPlaying(tracks, 1, "session-1");
      });
      expect(result.current.activeGameId).toBe("game-b");
    });
  });

  describe("playedTrackIds", () => {
    it("should mark tracks as played when the index changes", () => {
      const { result } = renderHook(() => usePlayerState());
      const tracks = [makeTrack("t1"), makeTrack("t2"), makeTrack("t3")];

      act(() => {
        result.current.startPlaying(tracks, 0, "session-1");
      });
      expect(result.current.playedTrackIds.has("t1")).toBe(true);

      act(() => {
        result.current.setCurrentTrackIndex(2);
      });
      expect(result.current.playedTrackIds.has("t1")).toBe(true);
      expect(result.current.playedTrackIds.has("t3")).toBe(true);
    });

    it("should clear played tracks but preserve the currently playing track", () => {
      const { result } = renderHook(() => usePlayerState());
      const tracks = [makeTrack("t1"), makeTrack("t2")];

      act(() => {
        result.current.startPlaying(tracks, 0, "session-1");
      });
      act(() => {
        result.current.setCurrentTrackIndex(1);
      });
      expect(result.current.playedTrackIds.size).toBe(2);

      act(() => {
        result.current.clearPlayedTracks();
      });
      // The currently playing track (t2) is preserved
      expect(result.current.playedTrackIds.size).toBe(1);
      expect(result.current.playedTrackIds.has("t2")).toBe(true);
      expect(result.current.playedTrackIds.has("t1")).toBe(false);
    });
  });
});
