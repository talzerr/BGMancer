import {
  sqliteTable,
  text,
  integer,
  real,
  index,
  uniqueIndex,
  primaryKey,
} from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

// ─── Timestamp default ───────────────────────────────────────────────────────

const timestampDefault = sql`(strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))`;

// ─── Users ───────────────────────────────────────────────────────────────────

export const users = sqliteTable("users", {
  id: text("id").notNull().primaryKey(),
  email: text("email").notNull().unique(),
  username: text("username"),
  is_generating: integer("is_generating", { mode: "boolean" }).notNull().default(false),
  last_generated_at: text("last_generated_at"),
  created_at: text("created_at").notNull().default(timestampDefault),
});

// ─── Games ───────────────────────────────────────────────────────────────────

export const games = sqliteTable(
  "games",
  {
    id: text("id").notNull().primaryKey(),
    title: text("title").notNull(),
    steam_appid: integer("steam_appid"),
    onboarding_phase: text("onboarding_phase").notNull().default("draft"),
    published: integer("published", { mode: "boolean" }).notNull().default(false),
    tracklist_source: text("tracklist_source"),
    yt_playlist_id: text("yt_playlist_id"),
    thumbnail_url: text("thumbnail_url"),
    needs_review: integer("needs_review", { mode: "boolean" }).notNull().default(false),
    created_at: text("created_at").notNull().default(timestampDefault),
    updated_at: text("updated_at").notNull().default(timestampDefault),
  },
  (table) => [
    index("idx_games_created").on(table.created_at),
    uniqueIndex("idx_games_steam_appid")
      .on(table.steam_appid)
      .where(sql`steam_appid IS NOT NULL`),
    index("idx_games_published").on(table.published),
    index("idx_games_onboarding").on(table.onboarding_phase),
    index("idx_games_needs_review").on(table.needs_review),
  ],
);

// ─── Libraries ───────────────────────────────────────────────────────────────

export const libraries = sqliteTable(
  "libraries",
  {
    id: text("id").notNull().primaryKey(),
    user_id: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    created_at: text("created_at").notNull().default(timestampDefault),
  },
  (table) => [uniqueIndex("idx_libraries_user").on(table.user_id)],
);

// ─── Library ↔ Game junction ─────────────────────────────────────────────────

export const libraryGames = sqliteTable(
  "library_games",
  {
    library_id: text("library_id")
      .notNull()
      .references(() => libraries.id, { onDelete: "cascade" }),
    game_id: text("game_id")
      .notNull()
      .references(() => games.id, { onDelete: "cascade" }),
    curation: text("curation").notNull().default("include"),
    added_at: text("added_at").notNull().default(timestampDefault),
  },
  (table) => [
    primaryKey({ columns: [table.library_id, table.game_id] }),
    index("idx_library_games_game").on(table.game_id),
    index("idx_library_games_lib_curation").on(table.library_id, table.curation, table.added_at),
  ],
);

// ─── Playlists (sessions) ────────────────────────────────────────────────────

export const playlists = sqliteTable(
  "playlists",
  {
    id: text("id").notNull().primaryKey(),
    user_id: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    is_archived: integer("is_archived", { mode: "boolean" }).notNull().default(false),
    rubric: text("rubric"),
    game_budgets: text("game_budgets"),
    created_at: text("created_at").notNull().default(timestampDefault),
  },
  (table) => [
    index("idx_playlists_user").on(table.user_id),
    index("idx_playlists_created").on(table.created_at),
    index("idx_playlists_user_archived").on(table.user_id, table.is_archived, table.created_at),
  ],
);

// ─── Playlist tracks ─────────────────────────────────────────────────────────

export const playlistTracks = sqliteTable(
  "playlist_tracks",
  {
    id: text("id").notNull().primaryKey(),
    playlist_id: text("playlist_id")
      .notNull()
      .references(() => playlists.id, { onDelete: "cascade" }),
    game_id: text("game_id")
      .notNull()
      .references(() => games.id, { onDelete: "cascade" }),
    track_name: text("track_name"),
    video_id: text("video_id"),
    video_title: text("video_title"),
    channel_title: text("channel_title"),
    thumbnail: text("thumbnail"),
    search_queries: text("search_queries"),
    duration_seconds: integer("duration_seconds"),
    position: integer("position").notNull().default(0),
    status: text("status").notNull().default("pending"),
    error_message: text("error_message"),
    created_at: text("created_at").notNull().default(timestampDefault),
    synced_at: text("synced_at"),
  },
  (table) => [
    index("idx_tracks_playlist").on(table.playlist_id),
    index("idx_tracks_game").on(table.game_id),
    index("idx_tracks_position").on(table.position),
    index("idx_tracks_status").on(table.status),
    index("idx_pt_playlist_status").on(table.playlist_id, table.status),
  ],
);

// ─── Playlist track decisions (Director telemetry) ───────────────────────────

export const playlistTrackDecisions = sqliteTable(
  "playlist_track_decisions",
  {
    playlist_id: text("playlist_id")
      .notNull()
      .references(() => playlists.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    arc_phase: text("arc_phase").notNull(),
    game_id: text("game_id").notNull(),
    track_video_id: text("track_video_id").notNull(),
    score_role: real("score_role").notNull().default(0),
    score_mood: real("score_mood").notNull().default(0),
    score_inst: real("score_inst").notNull().default(0),
    score_view_bias: real("score_view_bias").notNull().default(0),
    final_score: real("final_score").notNull().default(0),
    adjusted_score: real("adjusted_score").notNull().default(0),
    pool_size: integer("pool_size").notNull().default(0),
    game_budget: integer("game_budget").notNull().default(0),
    game_budget_used: integer("game_budget_used").notNull().default(0),
    selection_pass: text("selection_pass").notNull().default("scored"),
    rubric_used: integer("rubric_used", { mode: "boolean" }).notNull().default(false),
    view_bias_active: integer("view_bias_active", { mode: "boolean" }).notNull().default(false),
  },
  (table) => [primaryKey({ columns: [table.playlist_id, table.position] })],
);

// ─── Tracks (game soundtrack metadata) ───────────────────────────────────────

export const tracks = sqliteTable(
  "tracks",
  {
    game_id: text("game_id")
      .notNull()
      .references(() => games.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    position: integer("position").notNull(),
    duration_seconds: integer("duration_seconds"),
    energy: integer("energy"),
    roles: text("roles"),
    moods: text("moods"),
    instrumentation: text("instrumentation"),
    has_vocals: integer("has_vocals"),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    discovered: text("discovered"),
    tagged_at: text("tagged_at"),
  },
  (table) => [
    primaryKey({ columns: [table.game_id, table.name] }),
    index("idx_tracks_game_active").on(table.game_id, table.active),
    index("idx_tracks_tagged_at").on(table.tagged_at),
  ],
);

// ─── Game review flags ───────────────────────────────────────────────────────

export const gameReviewFlags = sqliteTable(
  "game_review_flags",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    game_id: text("game_id")
      .notNull()
      .references(() => games.id, { onDelete: "cascade" }),
    reason: text("reason").notNull(),
    detail: text("detail"),
    created_at: text("created_at").notNull().default(timestampDefault),
  },
  (table) => [index("idx_review_flags_game").on(table.game_id)],
);

// ─── Video tracks (YouTube alignment) ────────────────────────────────────────

export const videoTracks = sqliteTable(
  "video_tracks",
  {
    video_id: text("video_id").notNull(),
    game_id: text("game_id")
      .notNull()
      .references(() => games.id, { onDelete: "cascade" }),
    track_name: text("track_name"),
    duration_seconds: integer("duration_seconds"),
    view_count: integer("view_count"),
    aligned_at: text("aligned_at").notNull().default(timestampDefault),
  },
  (table) => [
    primaryKey({ columns: [table.video_id, table.game_id] }),
    index("idx_video_tracks_game_track").on(table.game_id, table.track_name),
  ],
);
