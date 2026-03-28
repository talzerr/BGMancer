// ─── Special game IDs ─────────────────────────────────────────────────────────

/** Synthetic game ID used for tracks imported directly from a YouTube playlist. */
export const YT_IMPORT_GAME_ID = "yt-import";

// ─── Session history ──────────────────────────────────────────────────────────

/** Maximum number of playlist history sessions kept per user. Oldest is evicted when exceeded. */
export const MAX_PLAYLIST_SESSIONS = 3;

/** Maximum characters allowed when renaming a session. */
export const SESSION_NAME_MAX_LENGTH = 100;

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
export const MAX_TRACK_DURATION_SECONDS = 540; // 9 minutes

// ─── Pipeline resolver tuning ─────────────────────────────────────────────────

/** Maximum YouTube playlist items sent to the LLM in a single alignment call. */
export const RESOLVE_BATCH_SIZE = 50;

/** Maximum per-track YouTube searches during the resolver fallback phase. */
export const RESOLVE_FALLBACK_MAX = 10;

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

// ─── Abuse limits ─────────────────────────────────────────────────────────────

/** Maximum number of games allowed in a user's library. */
export const LIBRARY_MAX_GAMES = 500;

/** Maximum published games returned by the catalog browser. */
export const CATALOG_PAGE_SIZE = 15;

/** Maximum tracks allowed per game (excess tracks from Discogs are dropped). */
export const GAME_MAX_TRACKS = 300;

/** Maximum characters allowed for a game title. */
export const GAME_TITLE_MAX_LENGTH = 200;

/** Maximum tracks allowed from a single YouTube playlist import. Matches MAX_TRACK_COUNT. */
export const YT_IMPORT_MAX_TRACKS = MAX_TRACK_COUNT;

/** Minimum milliseconds between playlist generations. */
export const GENERATION_COOLDOWN_MS = 30_000;

// ─── Director scoring weights ────────────────────────────────────────────────

/** Dimension weight for role match (binary: 1.0 if match, 0.0 if not). */
export const SCORE_WEIGHT_ROLE = 0.4;

/** Dimension weight for mood Jaccard similarity. */
export const SCORE_WEIGHT_MOOD = 0.35;

/** Dimension weight for instrumentation Jaccard similarity. */
export const SCORE_WEIGHT_INSTRUMENT = 0.25;

/** Multiplier applied when a track contains a penalized mood. */
export const SCORE_PENALTY_MULTIPLIER = 0.5;

/** Multiplier applied when rubric.allowVocals is false and track has vocals. */
export const SCORE_VOCALS_PENALTY_MULTIPLIER = 0.5;

// ─── View bias-enabled Director scoring weights ────────────────────────────────

/** Dimension weight for role match when View bias scoring is active. */
export const SCORE_WEIGHT_ROLE_VIEW_BIAS = 0.3;

/** Dimension weight for mood Jaccard similarity when View bias scoring is active. */
export const SCORE_WEIGHT_MOOD_VIEW_BIAS = 0.25;

/** Dimension weight for the View Bias score (log-scaled global heat + per-game local stature) when View Bias scoring is active. */
export const SCORE_WEIGHT_VIEW_BIAS = 0.3;

/** Dimension weight for instrumentation Jaccard similarity when View bias scoring is active. */
export const SCORE_WEIGHT_INSTRUMENT_VIEW_BIAS = 0.15;

/** Baseline View bias Score for tracks with no YouTube view data. */
export const VIEW_BIAS_SCORE_BASELINE = 0.3;

/** Number of top candidates for weighted random selection. */
export const DIRECTOR_TOP_N_POOL = 5;

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
