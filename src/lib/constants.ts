// ─── Special game IDs ─────────────────────────────────────────────────────────

/** Synthetic game ID used for tracks imported directly from a YouTube playlist. */
export const YT_IMPORT_GAME_ID = "yt-import";

// ─── Session history ──────────────────────────────────────────────────────────

/** Maximum number of playlist history sessions kept per user. Oldest is evicted when exceeded. */
export const MAX_PLAYLIST_SESSIONS = 3;

/** Maximum characters allowed when renaming a session. */
export const SESSION_NAME_MAX_LENGTH = 60;

/** Max game names shown in an auto-generated session name before "and more" is appended. */
export const SESSION_NAME_MAX_GAMES = 3;

// ─── Track count ──────────────────────────────────────────────────────────────

/** Default number of tracks to generate. */
export const DEFAULT_TRACK_COUNT = 50;

/** Maximum number of tracks that can be requested in a single generation or import. */
export const MAX_TRACK_COUNT = 150;

// ─── Track duration filtering ─────────────────────────────────────────────────

/** Tracks shorter than this (in seconds) are always excluded (intros, stingers, etc.). */
export const MIN_TRACK_DURATION_SECONDS = 90; // 1.5 minutes

/** Tracks longer than this (in seconds) are excluded when allow_long_tracks is off. */
export const MAX_TRACK_DURATION_SECONDS = 600; // 10 minutes

// ─── Pipeline candidate tuning ────────────────────────────────────────────────

/** Multiplier applied to per-game fair share to build the candidate pool (3× target). */
export const CANDIDATES_MULTIPLIER = 3;

/** Minimum candidates to request per game regardless of fair share. */
export const CANDIDATES_MIN = 5;

/** Maximum candidates to request per game (controls prompt size and API cost). */
export const CANDIDATES_MAX = 30;

// ─── Steam CDN ────────────────────────────────────────────────────────────────

/** Returns the Steam header image URL for a given app ID. */
export function steamHeaderUrl(appid: number): string {
  return `https://cdn.akamai.steamstatic.com/steam/apps/${appid}/header.jpg`;
}

// ─── Abuse limits ─────────────────────────────────────────────────────────────

/** Maximum number of games allowed in a user's library. */
export const LIBRARY_MAX_GAMES = 500;

/** Maximum characters allowed for a game title. */
export const GAME_TITLE_MAX_LENGTH = 200;

/** Maximum tracks allowed from a single YouTube playlist import. Matches MAX_TRACK_COUNT. */
export const YT_IMPORT_MAX_TRACKS = MAX_TRACK_COUNT;

/** Minimum milliseconds between playlist generations. */
export const GENERATION_COOLDOWN_MS = 30_000;

// ─── UI timing ────────────────────────────────────────────────────────────────

/** How long (ms) the undo toast stays visible before a track deletion is committed. */
export const UNDO_TOAST_DURATION_MS = 4000;

// ─── Cooldown quips ───────────────────────────────────────────────────────────

/** Shown on the generate button while the post-generation cooldown is active. */
export const COOLDOWN_QUIPS = [
  "The spirits are arguing over BPM.",
  "Low on mana. Altar recharging…",
  "The Bard is at the Inn.",
  "Your patience grants +2 Charisma.",
  "Between sets. Band's at the bar.",
  "The composer is taking five.",
  "Even the mancer needs a breather.",
  "Cauldron cooling between brews.",
  "Resting the rhythm section.",
  "The composer is stuck in a cutscene.",
] as const;
