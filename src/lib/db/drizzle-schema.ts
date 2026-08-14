import {
  pgTable,
  text,
  integer,
  real,
  boolean,
  index,
  uniqueIndex,
  primaryKey,
  timestamp,
  jsonb,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import type { VibeRubric } from "@/types";

// ─── Users ───────────────────────────────────────────────────────────────────

export const users = pgTable("users", {
  id: text("id").notNull().primaryKey(),
  email: text("email").notNull().unique(),
  username: text("username"),
  steam_id: text("steam_id"),
  steam_synced_at: timestamp("steam_synced_at", { withTimezone: true }),
  is_generating: boolean("is_generating").notNull().default(false),
  last_generated_at: timestamp("last_generated_at", { withTimezone: true }),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─── User ↔ Steam games ──────────────────────────────────────────────────────

export const userSteamGames = pgTable(
  "user_steam_games",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    user_id: text("user_id")
      .notNull()
      .references(() => users.id),
    steam_app_id: integer("steam_app_id").notNull(),
    playtime_minutes: integer("playtime_minutes").notNull().default(0),
  },
  (table) => [uniqueIndex("idx_user_steam_games_user_app").on(table.user_id, table.steam_app_id)],
);

// ─── Games ───────────────────────────────────────────────────────────────────

export const games = pgTable(
  "games",
  {
    id: text("id").notNull().primaryKey(),
    title: text("title").notNull(),
    steam_appid: integer("steam_appid"),
    onboarding_phase: text("onboarding_phase").notNull().default("draft"),
    published: boolean("published").notNull().default(false),
    tracklist_source: text("tracklist_source"),
    yt_playlist_id: text("yt_playlist_id"),
    thumbnail_url: text("thumbnail_url"),
    needs_review: boolean("needs_review").notNull().default(false),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
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

export const libraries = pgTable(
  "libraries",
  {
    id: text("id").notNull().primaryKey(),
    user_id: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("idx_libraries_user").on(table.user_id)],
);

// ─── Library ↔ Game junction ─────────────────────────────────────────────────

export const libraryGames = pgTable(
  "library_games",
  {
    library_id: text("library_id")
      .notNull()
      .references(() => libraries.id, { onDelete: "cascade" }),
    game_id: text("game_id")
      .notNull()
      .references(() => games.id, { onDelete: "cascade" }),
    curation: text("curation").notNull().default("include"),
    added_at: timestamp("added_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.library_id, table.game_id] }),
    index("idx_library_games_game").on(table.game_id),
    index("idx_library_games_lib_curation").on(table.library_id, table.curation, table.added_at),
  ],
);

// ─── Playlists (sessions) ────────────────────────────────────────────────────

export const playlists = pgTable(
  "playlists",
  {
    id: text("id").notNull().primaryKey(),
    user_id: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    is_archived: boolean("is_archived").notNull().default(false),
    playlist_mode: text("playlist_mode").notNull().default("journey"),
    rubric: jsonb("rubric").$type<VibeRubric>(),
    game_budgets: jsonb("game_budgets").$type<Record<string, number>>(),
    youtube_playlist_id: text("youtube_playlist_id"),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_playlists_user").on(table.user_id),
    index("idx_playlists_created").on(table.created_at),
    index("idx_playlists_user_archived").on(table.user_id, table.is_archived, table.created_at),
  ],
);

// ─── Playlist tracks ─────────────────────────────────────────────────────────

export const playlistTracks = pgTable(
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
    duration_seconds: integer("duration_seconds"),
    position: integer("position").notNull().default(0),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    synced_at: timestamp("synced_at", { withTimezone: true }),
  },
  (table) => [
    index("idx_tracks_playlist").on(table.playlist_id),
    index("idx_tracks_game").on(table.game_id),
    index("idx_tracks_position").on(table.position),
  ],
);

// ─── Playlist track decisions (Director telemetry) ───────────────────────────

export const playlistTrackDecisions = pgTable(
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
  },
  (table) => [primaryKey({ columns: [table.playlist_id, table.position] })],
);

// ─── Tracks (game soundtrack metadata) ───────────────────────────────────────

export const tracks = pgTable(
  "tracks",
  {
    game_id: text("game_id")
      .notNull()
      .references(() => games.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    position: integer("position").notNull(),
    energy: integer("energy"),
    roles: jsonb("roles").$type<string[]>(),
    moods: jsonb("moods").$type<string[]>(),
    instrumentation: jsonb("instrumentation").$type<string[]>(),
    has_vocals: integer("has_vocals"),
    active: boolean("active").notNull().default(true),
    discovered: text("discovered"),
    tagged_at: timestamp("tagged_at", { withTimezone: true }),
  },
  (table) => [
    primaryKey({ columns: [table.game_id, table.name] }),
    index("idx_tracks_game_active").on(table.game_id, table.active),
    index("idx_tracks_tagged_at").on(table.tagged_at),
  ],
);

// ─── Game review flags ───────────────────────────────────────────────────────

export const gameReviewFlags = pgTable(
  "game_review_flags",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    game_id: text("game_id")
      .notNull()
      .references(() => games.id, { onDelete: "cascade" }),
    reason: text("reason").notNull(),
    detail: text("detail"),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("idx_review_flags_game").on(table.game_id)],
);

// ─── Game requests (IGDB-backed "can't find your game?") ────────────────────

export const gameRequests = pgTable(
  "game_requests",
  {
    igdb_id: integer("igdb_id").notNull().primaryKey(),
    name: text("name").notNull(),
    cover_url: text("cover_url"),
    request_count: integer("request_count").notNull().default(1),
    acknowledged: boolean("acknowledged").notNull().default(false),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("idx_game_requests_ack_count").on(table.acknowledged, table.request_count)],
);

// ─── Video tracks (YouTube alignment) ────────────────────────────────────────

export const videoTracks = pgTable(
  "video_tracks",
  {
    video_id: text("video_id").notNull(),
    game_id: text("game_id")
      .notNull()
      .references(() => games.id, { onDelete: "cascade" }),
    track_name: text("track_name"),
    duration_seconds: integer("duration_seconds"),
    view_count: integer("view_count"),
    aligned_at: timestamp("aligned_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.video_id, table.game_id] }),
    index("idx_video_tracks_game_track").on(table.game_id, table.track_name),
  ],
);
