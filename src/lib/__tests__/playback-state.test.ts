// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import {
  readPlaybackState,
  savePlaybackState,
  patchPausedState,
  clearPlaybackState,
  savePlaybackTracks,
  readPlaybackTracks,
  saveRevealedTracks,
  readRevealedTracks,
  clearRevealedTracks,
  type SavedPlaybackState,
} from "../playback-state";
import type { PlaylistTrack } from "@/types";

const STATE_KEY = "bgm_playback_state";
const TRACKS_KEY = "bgm_playback_tracks";
const REVEALED_KEY = "bgm_revealed_tracks";

beforeEach(() => {
  localStorage.clear();
});

function makeState(): SavedPlaybackState {
  return {
    sessionId: "s-1",
    trackIndex: 3,
    positionSeconds: 42.5,
    videoId: "abc123",
  };
}

describe("readPlaybackState / savePlaybackState", () => {
  it("round-trips a valid state", () => {
    const state = makeState();
    savePlaybackState(state);
    expect(readPlaybackState()).toEqual(state);
  });

  it("returns null when key is absent", () => {
    expect(readPlaybackState()).toBeNull();
  });

  it("returns null when stored JSON is malformed", () => {
    localStorage.setItem(STATE_KEY, "{ not valid json");
    expect(readPlaybackState()).toBeNull();
  });

  it("returns null when sessionId is missing", () => {
    localStorage.setItem(
      STATE_KEY,
      JSON.stringify({ trackIndex: 0, positionSeconds: 0, videoId: "v" }),
    );
    expect(readPlaybackState()).toBeNull();
  });

  it("returns null when trackIndex is not a number", () => {
    localStorage.setItem(
      STATE_KEY,
      JSON.stringify({ sessionId: "s", trackIndex: "0", positionSeconds: 0, videoId: "v" }),
    );
    expect(readPlaybackState()).toBeNull();
  });

  it("returns null when positionSeconds is not a number", () => {
    localStorage.setItem(
      STATE_KEY,
      JSON.stringify({ sessionId: "s", trackIndex: 0, positionSeconds: null, videoId: "v" }),
    );
    expect(readPlaybackState()).toBeNull();
  });

  it("returns null when videoId is missing", () => {
    localStorage.setItem(
      STATE_KEY,
      JSON.stringify({ sessionId: "s", trackIndex: 0, positionSeconds: 0 }),
    );
    expect(readPlaybackState()).toBeNull();
  });

  it("returns null when the parsed payload is a primitive", () => {
    localStorage.setItem(STATE_KEY, JSON.stringify(42));
    expect(readPlaybackState()).toBeNull();
  });

  it("preserves an optional paused field", () => {
    const state = { ...makeState(), paused: true };
    savePlaybackState(state);
    expect(readPlaybackState()).toEqual(state);
  });
});

describe("patchPausedState", () => {
  it("flips paused on an existing state without losing fields", () => {
    const state = makeState();
    savePlaybackState(state);
    patchPausedState(true);
    expect(readPlaybackState()).toEqual({ ...state, paused: true });
  });

  it("also updates positionSeconds when provided", () => {
    const state = makeState();
    savePlaybackState(state);
    patchPausedState(false, 120);
    expect(readPlaybackState()).toEqual({ ...state, paused: false, positionSeconds: 120 });
  });

  it("is a no-op when no state exists", () => {
    patchPausedState(true);
    expect(localStorage.getItem(STATE_KEY)).toBeNull();
  });

  it("silently ignores malformed existing JSON", () => {
    localStorage.setItem(STATE_KEY, "not-json");
    patchPausedState(true);
    // Corrupt payload stays corrupt; reader recovers by returning null.
    expect(readPlaybackState()).toBeNull();
  });
});

describe("clearPlaybackState", () => {
  it("clears all three keys", () => {
    savePlaybackState(makeState());
    savePlaybackTracks([{ id: "t", video_id: "v" } as unknown as PlaylistTrack]);
    saveRevealedTracks(new Set(["a", "b"]));
    clearPlaybackState();
    expect(localStorage.getItem(STATE_KEY)).toBeNull();
    expect(localStorage.getItem(TRACKS_KEY)).toBeNull();
    expect(localStorage.getItem(REVEALED_KEY)).toBeNull();
  });
});

describe("savePlaybackTracks / readPlaybackTracks", () => {
  it("round-trips a track list", () => {
    const tracks = [
      { id: "t1", video_id: "v1" } as unknown as PlaylistTrack,
      { id: "t2", video_id: "v2" } as unknown as PlaylistTrack,
    ];
    savePlaybackTracks(tracks);
    expect(readPlaybackTracks()).toEqual(tracks);
  });

  it("returns null when key is absent", () => {
    expect(readPlaybackTracks()).toBeNull();
  });

  it("returns null when stored JSON is malformed", () => {
    localStorage.setItem(TRACKS_KEY, "{ not json");
    expect(readPlaybackTracks()).toBeNull();
  });

  it("returns null when stored value is not an array", () => {
    localStorage.setItem(TRACKS_KEY, JSON.stringify({ not: "an array" }));
    expect(readPlaybackTracks()).toBeNull();
  });

  it("returns null when stored array is empty", () => {
    localStorage.setItem(TRACKS_KEY, JSON.stringify([]));
    expect(readPlaybackTracks()).toBeNull();
  });
});

describe("saveRevealedTracks / readRevealedTracks", () => {
  it("round-trips a set of IDs", () => {
    saveRevealedTracks(new Set(["a", "b", "c"]));
    expect([...readRevealedTracks()].sort()).toEqual(["a", "b", "c"]);
  });

  it("returns an empty set when key is absent", () => {
    expect(readRevealedTracks().size).toBe(0);
  });

  it("returns an empty set when stored JSON is malformed", () => {
    localStorage.setItem(REVEALED_KEY, "nope");
    expect(readRevealedTracks().size).toBe(0);
  });

  it("returns an empty set when stored value is not an array", () => {
    localStorage.setItem(REVEALED_KEY, JSON.stringify("not-an-array"));
    expect(readRevealedTracks().size).toBe(0);
  });

  it("filters out non-string elements", () => {
    localStorage.setItem(REVEALED_KEY, JSON.stringify(["a", 1, null, "b", true]));
    expect([...readRevealedTracks()].sort()).toEqual(["a", "b"]);
  });

  it("clearRevealedTracks drops just the revealed key", () => {
    savePlaybackState(makeState());
    saveRevealedTracks(new Set(["x"]));
    clearRevealedTracks();
    expect(localStorage.getItem(REVEALED_KEY)).toBeNull();
    expect(localStorage.getItem(STATE_KEY)).not.toBeNull();
  });
});
