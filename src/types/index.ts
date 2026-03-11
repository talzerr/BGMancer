// ─── Users ────────────────────────────────────────────────────────────────────

/** Determines which AI provider is used for playlist generation.
 *  Bard    — all LLM calls use Ollama (local, no API key required)
 *  Maestro — all LLM calls use Anthropic (falls back to Ollama if key absent)
 */
export enum UserTier {
  Bard = "bard",
  Maestro = "maestro",
}

export interface User {
  id: string;
  email: string;
  username: string | null;
  tier: UserTier;
  created_at: string;
}

// ─── Playlist sessions ────────────────────────────────────────────────────────

export interface PlaylistSession {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  is_archived: boolean;
  created_at: string;
}

export interface PlaylistSessionWithCount extends PlaylistSession {
  track_count: number;
}

// ─── Game library ─────────────────────────────────────────────────────────────

/** Controls how a game participates in playlist generation.
 *  Skip    — excluded entirely
 *  Lite    — enters curation with half as many candidates (appears occasionally)
 *  Include — standard inclusion (default)
 *  Focus   — guaranteed tracks in every playlist, bypasses AI curation
 */
export enum CurationMode {
  Skip = "skip",
  Lite = "lite",
  Include = "include",
  Focus = "focus",
}

export interface Game {
  id: string;
  title: string;
  allow_full_ost: boolean;
  curation: CurationMode;
  steam_appid: number | null;
  playtime_minutes: number | null;
  created_at: string;
  updated_at: string;
}

export interface AddGamePayload {
  title: string;
  steam_appid?: number;
}

// ─── Playlist ─────────────────────────────────────────────────────────────────

export enum TrackStatus {
  Pending = "pending",
  Searching = "searching",
  Found = "found",
  Error = "error",
}

// ─── Generation progress ──────────────────────────────────────────────────────

/** Per-game UI status during playlist generation. */
export enum GameProgressStatus {
  Waiting = "waiting",
  Active = "active",
  Done = "done",
  Error = "error",
}

export interface PlaylistTrack {
  id: string;
  playlist_id: string;
  game_id: string;
  game_title?: string; // populated via JOIN in API responses
  track_name: string | null; // null for full-OST compilation slots
  video_id: string | null;
  video_title: string | null;
  channel_title: string | null;
  thumbnail: string | null;
  search_queries: string[] | null;
  duration_seconds: number | null;
  position: number;
  status: TrackStatus;
  error_message: string | null;
  created_at: string;
  synced_at: string | null;
}

// ─── Config ───────────────────────────────────────────────────────────────────

export interface AppConfig {
  target_track_count: number;
  anti_spoiler_enabled: boolean;
  allow_long_tracks: boolean;
}

// ─── YouTube ──────────────────────────────────────────────────────────────────

export type TrackRole = "opener" | "ambient" | "build" | "combat" | "closer" | "menu" | "cinematic";

export interface TaggedTrack {
  videoId: string;
  title: string;
  channelTitle: string;
  thumbnail: string;
  gameId: string;
  gameTitle: string;
  cleanName: string;
  energy: 1 | 2 | 3;
  role: TrackRole;
  isJunk: boolean;
}

export interface VibeScore {
  fitScore: number; // 1-100, how well this track fits the session mood/context
}

export interface YouTubeSearchResult {
  videoId: string;
  title: string;
  channelTitle: string;
  thumbnail: string;
  durationSeconds: number;
  description: string;
}
