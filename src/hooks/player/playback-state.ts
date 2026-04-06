import type { PlaylistTrack } from "@/types";

export interface SavedPlaybackState {
  sessionId: string;
  trackIndex: number;
  positionSeconds: number;
  videoId: string;
}

const PLAYBACK_STATE_KEY = "bgm_playback_state";
const PLAYBACK_TRACKS_KEY = "bgm_playback_tracks";
const REVEALED_TRACKS_KEY = "bgm_revealed_tracks";

function isValidState(s: unknown): s is SavedPlaybackState {
  return (
    typeof s === "object" &&
    s !== null &&
    typeof (s as SavedPlaybackState).sessionId === "string" &&
    typeof (s as SavedPlaybackState).trackIndex === "number" &&
    typeof (s as SavedPlaybackState).positionSeconds === "number" &&
    typeof (s as SavedPlaybackState).videoId === "string"
  );
}

export function readPlaybackState(): SavedPlaybackState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(PLAYBACK_STATE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isValidState(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function savePlaybackState(state: SavedPlaybackState): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(PLAYBACK_STATE_KEY, JSON.stringify(state));
}

export function clearPlaybackState(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(PLAYBACK_STATE_KEY);
  localStorage.removeItem(PLAYBACK_TRACKS_KEY);
  localStorage.removeItem(REVEALED_TRACKS_KEY);
}

// ─── Track cache (separate key, written only when tracks change) ─────────────

export function savePlaybackTracks(tracks: PlaylistTrack[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(PLAYBACK_TRACKS_KEY, JSON.stringify(tracks));
}

export function readPlaybackTracks(): PlaylistTrack[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(PLAYBACK_TRACKS_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    return parsed as PlaylistTrack[];
  } catch {
    return null;
  }
}

export function saveRevealedTracks(ids: Set<string>): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(REVEALED_TRACKS_KEY, JSON.stringify([...ids]));
}

export function readRevealedTracks(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(REVEALED_TRACKS_KEY);
    if (!raw) return new Set();
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((v): v is string => typeof v === "string"));
  } catch {
    return new Set();
  }
}

export function clearRevealedTracks(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(REVEALED_TRACKS_KEY);
}
