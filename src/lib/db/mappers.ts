import type { Game, PlaylistTrack, PlaylistSession, TrackStatus, User } from "@/types";

const VALID_STATUSES: Set<string> = new Set(["pending", "searching", "found", "error"]);

export function toUser(row: Record<string, unknown>): User {
  return {
    id: String(row.id),
    email: String(row.email),
    username: row.username != null ? String(row.username) : null,
    created_at: String(row.created_at ?? ""),
  };
}

export function toPlaylistSession(row: Record<string, unknown>): PlaylistSession {
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    name: String(row.name),
    description: row.description != null ? String(row.description) : null,
    is_archived: !!row.is_archived,
    created_at: String(row.created_at ?? ""),
  };
}

export function toPlaylistSessions(rows: unknown[]): PlaylistSession[] {
  return (rows as Record<string, unknown>[]).map(toPlaylistSession);
}

export function toGame(row: Record<string, unknown>): Game {
  return {
    id: String(row.id),
    title: String(row.title),
    allow_full_ost: !!row.allow_full_ost,
    enabled: row.enabled !== 0,
    steam_appid: row.steam_appid != null ? Number(row.steam_appid) : null,
    playtime_minutes: row.playtime_minutes != null ? Number(row.playtime_minutes) : null,
    created_at: String(row.created_at ?? ""),
    updated_at: String(row.updated_at ?? ""),
  };
}

export function toGames(rows: unknown[]): Game[] {
  return (rows as Record<string, unknown>[]).map(toGame);
}

export function parseSearchQueries(raw: unknown): string[] | null {
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
    playlist_id: String(row.playlist_id ?? ""),
    game_id: String(row.game_id),
    game_title: row.game_title != null ? String(row.game_title) : undefined,
    track_name: row.track_name != null ? String(row.track_name) : null,
    video_id: row.video_id != null ? String(row.video_id) : null,
    video_title: row.video_title != null ? String(row.video_title) : null,
    channel_title: row.channel_title != null ? String(row.channel_title) : null,
    thumbnail: row.thumbnail != null ? String(row.thumbnail) : null,
    search_queries: parseSearchQueries(row.search_queries),
    duration_seconds: row.duration_seconds != null ? Number(row.duration_seconds) : null,
    position: Number(row.position ?? 0),
    status: VALID_STATUSES.has(row.status as string) ? (row.status as TrackStatus) : "pending",
    error_message: row.error_message != null ? String(row.error_message) : null,
    created_at: String(row.created_at ?? ""),
    synced_at: row.synced_at != null ? String(row.synced_at) : null,
  };
}

export function toPlaylistTracks(rows: unknown[]): PlaylistTrack[] {
  return (rows as Record<string, unknown>[]).map(toPlaylistTrack);
}
