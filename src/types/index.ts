// ─── Users ────────────────────────────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  username: string | null;
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

export enum TaggingStatus {
  Pending = "pending",
  Indexing = "indexing",
  Ready = "ready",
  Limited = "limited",
  Failed = "failed",
}

export enum ReviewReason {
  LlmCallFailed = "llm_call_failed",
  LlmParseFailed = "llm_parse_failed",
  LowConfidence = "low_confidence",
  EmptyMetadata = "empty_metadata",
  NoDiscogsData = "no_discogs_data",
  TrackDiscovered = "track_discovered",
  TrackCapReached = "track_cap_reached",
}

export enum TrackMood {
  Epic = "epic",
  Tense = "tense",
  Peaceful = "peaceful",
  Melancholic = "melancholic",
  Triumphant = "triumphant",
  Mysterious = "mysterious",
  Playful = "playful",
  Dark = "dark",
  Ethereal = "ethereal",
  Heroic = "heroic",
  Nostalgic = "nostalgic",
  Ominous = "ominous",
  Serene = "serene",
  Chaotic = "chaotic",
  Whimsical = "whimsical",
}

export enum TrackInstrumentation {
  Orchestral = "orchestral",
  Synth = "synth",
  Acoustic = "acoustic",
  Chiptune = "chiptune",
  Piano = "piano",
  Rock = "rock",
  Metal = "metal",
  Electronic = "electronic",
  Choir = "choir",
  Ambient = "ambient",
  Jazz = "jazz",
  Folk = "folk",
  Strings = "strings",
  Brass = "brass",
  Percussion = "percussion",
}

export interface Game {
  id: string;
  title: string;
  curation: CurationMode;
  steam_appid: number | null;
  playtime_minutes: number | null;
  tagging_status: TaggingStatus;
  tracklist_source: string | null;
  yt_playlist_id: string | null;
  needs_review: boolean;
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
  game_steam_appid?: number | null; // populated via JOIN in API responses
  track_name: string | null;
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
  allow_short_tracks: boolean;
  raw_vibes: boolean;
}

// ─── Director telemetry ──────────────────────────────────────────────────────

/** How a track was selected for its arc slot. */
export enum SelectionPass {
  FocusPre = "focus_pre",
  Scored = "scored",
  Fallback = "fallback",
  LastResort = "last_resort",
}

/** The six phases of the Director's energy arc. */
export enum ArcPhase {
  Intro = "intro",
  Rising = "rising",
  Peak = "peak",
  Valley = "valley",
  Climax = "climax",
  Outro = "outro",
}

/** Per-dimension score breakdown from scoreTrack. */
export interface ScoreBreakdown {
  roleScore: number;
  moodScore: number;
  instScore: number;
  viewBiasScore: number;
  finalScore: number;
  adjustedScore: number;
}

/** One row of Director telemetry — captures why a track was placed in a slot. */
export interface TrackDecision {
  position: number;
  arcPhase: ArcPhase;
  gameId: string;
  trackVideoId: string;
  /** Role dimension score (0.0 or 1.0 — binary match). */
  roleScore: number;
  /** Mood dimension score (Jaccard, 0.0–1.0). */
  moodScore: number;
  /** Instrumentation dimension score (Jaccard, 0.0–1.0). */
  instScore: number;
  /** View bias dimension score (YouTube view count popularity, 0.0–1.0). */
  viewBiasScore: number;
  finalScore: number;
  adjustedScore: number;
  poolSize: number;
  gameBudget: number;
  /** Count of tracks already used from this game *before* this slot was filled. */
  gameBudgetUsed: number;
  selectionPass: SelectionPass;
  rubricUsed: boolean;
  /** True when view bias scoring was active for this session (raw vibes toggle was off). */
  viewBiasActive: boolean;
}

/** Full output of assemblePlaylist — tracks + telemetry. */
export interface DirectorResult {
  tracks: TaggedTrack[];
  decisions: TrackDecision[];
  rubric?: ScoringRubric;
  gameBudgets: Record<string, number>;
}

// ─── YouTube ──────────────────────────────────────────────────────────────────

export enum TrackRole {
  Opener = "opener",
  Ambient = "ambient",
  Build = "build",
  Combat = "combat",
  Closer = "closer",
  Menu = "menu",
  Cinematic = "cinematic",
}

export interface TaggedTrack {
  videoId: string;
  title: string;
  channelTitle: string;
  thumbnail: string;
  gameId: string;
  gameTitle: string;
  cleanName: string;
  energy: 1 | 2 | 3;
  roles: TrackRole[];
  isJunk: boolean;
  moods: TrackMood[];
  instrumentation: TrackInstrumentation[];
  hasVocals: boolean;
  durationSeconds: number;
  viewCount: number | null;
}

export interface Track {
  gameId: string;
  name: string;
  position: number;
  durationSeconds: number | null;
  energy: 1 | 2 | 3 | null;
  roles: TrackRole[];
  moods: TrackMood[];
  instrumentation: TrackInstrumentation[];
  hasVocals: boolean | null;
  active: boolean;
  taggedAt: string | null;
}

export interface ResolvedTrack {
  videoId: string;
  videoTitle: string;
  channelTitle: string;
  thumbnail: string;
  gameId: string;
  trackName: string;
  durationSeconds: number | null;
  energy: 1 | 2 | 3 | null;
  roles: TrackRole[];
  moods: TrackMood[];
  instrumentation: TrackInstrumentation[];
  hasVocals: boolean | null;
}

export interface ScoringRubric {
  targetEnergy: Array<1 | 2 | 3>;
  preferredMoods: TrackMood[];
  penalizedMoods: TrackMood[];
  preferredInstrumentation: TrackInstrumentation[];
  penalizedInstrumentation: TrackInstrumentation[];
  allowVocals: boolean | null;
  preferredRoles: TrackRole[];
}

export interface YouTubeSearchResult {
  videoId: string;
  title: string;
  channelTitle: string;
  thumbnail: string;
  durationSeconds: number;
  description: string;
}
