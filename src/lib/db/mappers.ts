import {
  CurationMode,
  DiscoveredStatus,
  OnboardingPhase,
  TrackMood,
  TrackInstrumentation,
  TrackRole,
} from "@/types";
import type { Game, PlaylistTrack, PlaylistSession, Track, User } from "@/types";

const VALID_ONBOARDING_PHASES = new Set<string>(Object.values(OnboardingPhase));

export const VALID_CURATIONS = new Set<CurationMode>(Object.values(CurationMode) as CurationMode[]);

export function toUser(row: Record<string, unknown>): User {
  return {
    id: String(row.id),
    email: String(row.email),
    username: row.username != null ? String(row.username) : null,
    steam_id: row.steam_id != null ? String(row.steam_id) : null,
    steam_synced_at: row.steam_synced_at != null ? String(row.steam_synced_at) : null,
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
  const rawPhase = String(row.onboarding_phase ?? OnboardingPhase.Draft);
  const onboarding_phase: OnboardingPhase = VALID_ONBOARDING_PHASES.has(rawPhase)
    ? (rawPhase as OnboardingPhase)
    : OnboardingPhase.Draft;
  return {
    id: String(row.id),
    title: String(row.title),
    curation,
    steam_appid: row.steam_appid != null ? Number(row.steam_appid) : null,
    onboarding_phase,
    published: !!row.published,
    tracklist_source: row.tracklist_source != null ? String(row.tracklist_source) : null,
    yt_playlist_id: row.yt_playlist_id != null ? String(row.yt_playlist_id) : null,
    thumbnail_url: row.thumbnail_url != null ? String(row.thumbnail_url) : null,
    needs_review: !!row.needs_review,
    created_at: String(row.created_at ?? ""),
    updated_at: String(row.updated_at ?? ""),
  };
}

export function toGames(rows: unknown[]): Game[] {
  return (rows as Record<string, unknown>[]).map(toGame);
}

export function toPlaylistTrack(row: Record<string, unknown>): PlaylistTrack {
  return {
    id: String(row.id),
    playlist_id: String(row.playlist_id ?? ""),
    game_id: String(row.game_id),
    game_title: row.game_title != null ? String(row.game_title) : undefined,
    game_thumbnail_url: row.game_thumbnail_url != null ? String(row.game_thumbnail_url) : null,
    track_name: row.track_name != null ? String(row.track_name) : null,
    video_id: row.video_id != null ? String(row.video_id) : null,
    video_title: row.video_title != null ? String(row.video_title) : null,
    channel_title: row.channel_title != null ? String(row.channel_title) : null,
    thumbnail: row.thumbnail != null ? String(row.thumbnail) : null,
    duration_seconds: row.duration_seconds != null ? Number(row.duration_seconds) : null,
    position: Number(row.position ?? 0),
    created_at: String(row.created_at ?? ""),
    synced_at: row.synced_at != null ? String(row.synced_at) : null,
    arc_phase: row.arc_phase != null ? String(row.arc_phase) : null,
  };
}

export function toPlaylistTracks(rows: unknown[]): PlaylistTrack[] {
  return (rows as Record<string, unknown>[]).map(toPlaylistTrack);
}

const VALID_DISCOVERED = new Set<string>(Object.values(DiscoveredStatus));
const VALID_MOODS = new Set<string>(Object.values(TrackMood));
const VALID_INSTRUMENTATIONS = new Set<string>(Object.values(TrackInstrumentation));
const VALID_ROLES = new Set<string>(Object.values(TrackRole));

export function parseJsonArray<T>(raw: unknown, validSet: Set<string>): T[] {
  if (raw == null) return [];
  let arr: unknown[];
  if (Array.isArray(raw)) {
    arr = raw;
  } else if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      arr = Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  } else {
    return [];
  }
  return arr.filter((v) => typeof v === "string" && validSet.has(v)) as T[];
}

export function toTrack(row: Record<string, unknown>): Track {
  const rawEnergy = row.energy != null ? Number(row.energy) : null;
  const energy = rawEnergy === 1 || rawEnergy === 2 || rawEnergy === 3 ? rawEnergy : null;
  const roles = parseJsonArray<TrackRole>(row.roles, VALID_ROLES);
  return {
    gameId: String(row.game_id),
    name: String(row.name),
    position: Number(row.position ?? 0),
    energy,
    roles,
    moods: parseJsonArray<TrackMood>(row.moods, VALID_MOODS),
    instrumentation: parseJsonArray<TrackInstrumentation>(
      row.instrumentation,
      VALID_INSTRUMENTATIONS,
    ),
    hasVocals: row.has_vocals != null ? !!row.has_vocals : null,
    active: row.active !== 0,
    discovered: VALID_DISCOVERED.has(row.discovered as string)
      ? (row.discovered as DiscoveredStatus)
      : null,
    taggedAt: row.tagged_at != null ? String(row.tagged_at) : null,
  };
}

export function toTracks(rows: unknown[]): Track[] {
  return (rows as Record<string, unknown>[]).map(toTrack);
}
