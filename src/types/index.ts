export type VibePreference =
  | "official_soundtrack"
  | "boss_themes"
  | "ambient_exploration";

export const VIBE_LABELS: Record<VibePreference, string> = {
  official_soundtrack: "Official Soundtrack",
  boss_themes: "Boss Themes",
  ambient_exploration: "Ambient & Exploration",
};

export type GameStatus = "pending" | "searching" | "found" | "synced" | "error";

export interface Game {
  id: string;
  title: string;
  vibe_preference: VibePreference;
  current_video_id: string | null;
  video_title: string | null;
  channel_title: string | null;
  video_thumbnail: string | null;
  search_queries: string[] | null;
  status: GameStatus;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface AddGamePayload {
  title: string;
  vibe_preference: VibePreference;
}

export interface CuratorResult {
  game_id: string;
  search_queries: string[];
  video_id: string;
  video_title: string;
  channel_title: string;
  video_thumbnail: string;
}

export interface YouTubeSearchResult {
  videoId: string;
  title: string;
  channelTitle: string;
  thumbnail: string;
  durationSeconds: number;
  description: string;
}
