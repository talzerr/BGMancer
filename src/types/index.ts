export const VIBE_LABELS = {
  official_soundtrack: "Official Soundtrack",
  boss_themes:         "Boss Themes",
  ambient_exploration: "Ambient & Exploration",
  study_focus:         "Study / Deep Work",
  workout_hype:        "Workout / Hype",
  emotional_story:     "Emotional / Story",
} as const;

export type VibePreference = keyof typeof VIBE_LABELS;

// ─── Game library ─────────────────────────────────────────────────────────────

export interface Game {
  id: string;
  title: string;
  allow_full_ost: boolean;
  enabled: boolean;
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

export type TrackStatus = "pending" | "searching" | "found" | "error";

export interface PlaylistTrack {
  id: string;
  game_id: string;
  game_title?: string;        // populated via JOIN in API responses
  track_name: string | null;  // null for full-OST compilation slots
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
  youtube_playlist_id: string;
  vibe: VibePreference;
}

// ─── YouTube ──────────────────────────────────────────────────────────────────

export interface YouTubeSearchResult {
  videoId: string;
  title: string;
  channelTitle: string;
  thumbnail: string;
  durationSeconds: number;
  description: string;
}
