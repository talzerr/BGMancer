import type { Game, PlaylistTrack, TrackStatus, VibePreference } from "@/types";

const VALID_VIBES: Set<string> = new Set([
  "official_soundtrack",
  "boss_themes",
  "ambient_exploration",
]);

const VALID_STATUSES: Set<string> = new Set([
  "pending",
  "searching",
  "found",
  "error",
]);

export function toGame(row: Record<string, unknown>): Game {
  return {
    id: String(row.id),
    title: String(row.title),
    vibe_preference: VALID_VIBES.has(row.vibe_preference as string)
      ? (row.vibe_preference as VibePreference)
      : "official_soundtrack",
    allow_full_ost: !!(row.allow_full_ost),
    created_at: String(row.created_at ?? ""),
    updated_at: String(row.updated_at ?? ""),
  };
}

export function toGames(rows: unknown[]): Game[] {
  return (rows as Record<string, unknown>[]).map(toGame);
}

function parseSearchQueries(raw: unknown): string[] | null {
  if (raw == null) return null;
  if (Array.isArray(raw)) return raw as string[];
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }
  return null;
}

export function toPlaylistTrack(row: Record<string, unknown>): PlaylistTrack {
  return {
    id: String(row.id),
    game_id: String(row.game_id),
    game_title: row.game_title != null ? String(row.game_title) : undefined,
    track_name: row.track_name != null ? String(row.track_name) : null,
    video_id: row.video_id != null ? String(row.video_id) : null,
    video_title: row.video_title != null ? String(row.video_title) : null,
    channel_title: row.channel_title != null ? String(row.channel_title) : null,
    thumbnail: row.thumbnail != null ? String(row.thumbnail) : null,
    search_queries: parseSearchQueries(row.search_queries),
    position: Number(row.position ?? 0),
    status: VALID_STATUSES.has(row.status as string)
      ? (row.status as TrackStatus)
      : "pending",
    error_message: row.error_message != null ? String(row.error_message) : null,
    created_at: String(row.created_at ?? ""),
    synced_at: row.synced_at != null ? String(row.synced_at) : null,
  };
}

export function toPlaylistTracks(rows: unknown[]): PlaylistTrack[] {
  return (rows as Record<string, unknown>[]).map(toPlaylistTrack);
}
