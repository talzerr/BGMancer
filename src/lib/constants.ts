// ─── Guest identity ──────────────────────────────────────────────────────────

/** Session ID used for guest (unauthenticated) playlist sessions. */
export const GUEST_SESSION_ID = "guest";

// ─── Session history ──────────────────────────────────────────────────────────

/** Maximum number of playlist history sessions kept per user. Oldest is evicted when exceeded. */
export const MAX_PLAYLIST_SESSIONS = 3;

/** Maximum characters allowed when renaming a session. */
export const SESSION_NAME_MAX_LENGTH = 50;

/** Max game names shown in an auto-generated session name before "and more" is appended. */
export const SESSION_NAME_MAX_GAMES = 3;

/** Build a deterministic session name from a list of game names. */
export function buildSessionName(gameNames: string[]): string {
  const unique = [...new Set(gameNames)];
  const raw =
    unique.slice(0, SESSION_NAME_MAX_GAMES).join(", ") +
    (unique.length > SESSION_NAME_MAX_GAMES ? " and more" : "");
  return raw.length > SESSION_NAME_MAX_LENGTH
    ? `${raw.slice(0, SESSION_NAME_MAX_LENGTH - 1).trimEnd()}…`
    : raw;
}

// ─── Track count ──────────────────────────────────────────────────────────────

/** Default number of tracks to generate. */
export const DEFAULT_TRACK_COUNT = 50;

/** Maximum number of tracks that can be requested in a single generation. */
export const MAX_TRACK_COUNT = 150;

// ─── Track duration filtering ─────────────────────────────────────────────────

/** Tracks shorter than this (in seconds) are auto-deactivated during onboarding (SFX, jingles). */
export const SFX_DURATION_THRESHOLD_SECONDS = 15;

/** Tracks shorter than this (in seconds) are excluded when allow_short_tracks is off. */
export const MIN_TRACK_DURATION_SECONDS = 90; // 1.5 minutes

/** Tracks longer than this (in seconds) are excluded when allow_long_tracks is off. */
export const MAX_TRACK_DURATION_SECONDS = 540; // 9 minutes

// ─── Pipeline resolver tuning ─────────────────────────────────────────────────

/** Maximum YouTube playlist items sent to the LLM in a single alignment call. */
export const RESOLVE_BATCH_SIZE = 50;

/** Maximum per-track YouTube searches during the resolver fallback phase. */
export const RESOLVE_FALLBACK_MAX = 10;

/** Maximum tracks per game to resolve (mirrors TAG_POOL_MAX for consistency). */
export const RESOLVE_POOL_MAX = 80;

// ─── Pipeline tagging tuning ──────────────────────────────────────────────────

/** Maximum tracks sent to the LLM in a single tagging call. */
export const TAG_BATCH_SIZE = 25;

/** Maximum tracks per game to tag (controls total LLM cost per game). */
export const TAG_POOL_MAX = 80;

// ─── Steam CDN ────────────────────────────────────────────────────────────────

/** Returns the Steam header image URL for a given app ID. */
export function steamHeaderUrl(appid: number): string {
  return `https://cdn.akamai.steamstatic.com/steam/apps/${appid}/header.jpg`;
}

// ─── Steam sync ───────────────────────────────────────────────────────────────

/** Minimum milliseconds between per-user Steam library re-syncs. */
export const STEAM_SYNC_COOLDOWN_MS = 60 * 60 * 1000; // 1 hour

/** Maximum games persisted per user per sync (top-N by playtime). */
export const STEAM_SYNC_MAX_GAMES = 500;

// ─── Abuse limits ─────────────────────────────────────────────────────────────

/** Maximum number of games allowed in a user's library. */
export const LIBRARY_MAX_GAMES = 25;

/** Maximum tracks allowed per game (excess tracks from Discogs are dropped). */
export const GAME_MAX_TRACKS = 300;

/** Maximum characters allowed for a game title. */
export const GAME_TITLE_MAX_LENGTH = 100;

/** Minimum milliseconds between playlist generations. */
export const GENERATION_COOLDOWN_MS = 30_000;

/** Maximum LLM-powered (Vibe Profiler) generations per logged-in user per day. */
export const USER_DAILY_LLM_CAP = 10;

/** Maximum guest requests per IP within the guest rate limit window. */
export const GUEST_MAX_REQUESTS = 10;

/** Guest rate limit window in milliseconds (10 minutes). */
export const GUEST_WINDOW_MS = 10 * 60 * 1000;

// ─── YouTube search tuning ──────────────────────────────────────────────────

/** Maximum video duration (seconds) for a single track. Longer videos are likely compilations. */
export const YT_MAX_VIDEO_DURATION_SECONDS = 15 * 60; // 15 minutes

/** Maximum video IDs per YouTube videos.list request. */
export const YT_VIDEOS_PAGE_SIZE = 50;

// ─── LLM defaults ───────────────────────────────────────────────────────────

/** Default Anthropic model when no override is configured. */
export const DEFAULT_LLM_MODEL = "claude-haiku-4-5-20251001";

/** Default max tokens for LLM calls. */
export const DEFAULT_LLM_MAX_TOKENS = 2048;

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
