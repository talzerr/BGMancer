import { CurationMode, TaggingStatus, TrackStatus, UserTier } from "@/types";
import type { Game, PlaylistTrack, PlaylistSession, User } from "@/types";

const VALID_TIERS = new Set<string>(Object.values(UserTier));
const VALID_STATUSES = new Set<string>(Object.values(TrackStatus));
const VALID_TAGGING_STATUSES = new Set<string>(Object.values(TaggingStatus));

export const VALID_CURATIONS = new Set<CurationMode>(Object.values(CurationMode) as CurationMode[]);

export function toUser(row: Record<string, unknown>): User {
  const rawTier = String(row.tier ?? UserTier.Bard);
  return {
    id: String(row.id),
    email: String(row.email),
    username: row.username != null ? String(row.username) : null,
    tier: VALID_TIERS.has(rawTier) ? (rawTier as UserTier) : UserTier.Bard,
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

export function toGame(row: Record<string, unknown>): Game {
  const raw = String(row.curation ?? CurationMode.Include);
  const curation: CurationMode = VALID_CURATIONS.has(raw as CurationMode)
    ? (raw as CurationMode)
    : CurationMode.Include;
  const rawStatus = String(row.tagging_status ?? TaggingStatus.Pending);
  const tagging_status: TaggingStatus = VALID_TAGGING_STATUSES.has(rawStatus)
    ? (rawStatus as TaggingStatus)
    : TaggingStatus.Pending;
  return {
    id: String(row.id),
    title: String(row.title),
    allow_full_ost: !!row.allow_full_ost,
    curation,
    steam_appid: row.steam_appid != null ? Number(row.steam_appid) : null,
    playtime_minutes: row.playtime_minutes != null ? Number(row.playtime_minutes) : null,
    tagging_status,
    mb_release_id: row.mb_release_id != null ? String(row.mb_release_id) : null,
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
    status: VALID_STATUSES.has(row.status as string)
      ? (row.status as TrackStatus)
      : TrackStatus.Pending,
    error_message: row.error_message != null ? String(row.error_message) : null,
    created_at: String(row.created_at ?? ""),
    synced_at: row.synced_at != null ? String(row.synced_at) : null,
  };
}

export function toPlaylistTracks(rows: unknown[]): PlaylistTrack[] {
  return (rows as Record<string, unknown>[]).map(toPlaylistTrack);
}
