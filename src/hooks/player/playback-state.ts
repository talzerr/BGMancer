export interface SavedPlaybackState {
  sessionId: string;
  trackIndex: number;
  positionSeconds: number;
  videoId: string;
}

const PLAYBACK_STATE_KEY = "bgm_playback_state";

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
}
