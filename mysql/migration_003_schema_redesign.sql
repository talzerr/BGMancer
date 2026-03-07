-- Migration 003: Track-based playlist schema redesign
-- Drops the old games table and recreates with new schema.
-- Creates playlist_tracks and config tables.
--
-- WARNING: This drops all existing game data.
-- Run: mysql -h 127.0.0.1 -u root -p bgmancer < mysql/migration_003_schema_redesign.sql

USE bgmancer;

-- ─── Drop old tables (order matters due to FK constraints) ───────────────────
DROP TABLE IF EXISTS playlist_tracks;
DROP TABLE IF EXISTS games;
DROP TABLE IF EXISTS config;

-- ─── games ───────────────────────────────────────────────────────────────────
-- The curated game library. One row per game the user wants music for.
CREATE TABLE games (
  id            VARCHAR(36)  NOT NULL PRIMARY KEY,
  title         TEXT         NOT NULL,
  vibe_preference VARCHAR(50) NOT NULL,
  allow_full_ost  BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_created (created_at)
);

-- ─── playlist_tracks ─────────────────────────────────────────────────────────
-- One row per track slot in the generated playlist.
-- track_name is populated by the LLM (null when allow_full_ost = true).
-- video_* fields are populated after the YouTube search step.
CREATE TABLE playlist_tracks (
  id              VARCHAR(36)  NOT NULL PRIMARY KEY,
  game_id         VARCHAR(36)  NOT NULL,
  track_name      TEXT,                          -- null for full-OST slots
  video_id        VARCHAR(50),
  video_title     TEXT,
  channel_title   TEXT,
  thumbnail       TEXT,
  search_queries  JSON,
  position        INT          NOT NULL DEFAULT 0,
  status          VARCHAR(20)  NOT NULL DEFAULT 'pending',  -- pending | searching | found | error
  error_message   TEXT,
  created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,

  INDEX idx_game_id (game_id),
  INDEX idx_position (position),
  INDEX idx_status (status),
  CONSTRAINT fk_track_game FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
);

-- ─── config ──────────────────────────────────────────────────────────────────
-- App-wide settings stored as key/value pairs.
CREATE TABLE config (
  `key`       VARCHAR(50)  NOT NULL PRIMARY KEY,
  value       TEXT         NOT NULL,
  updated_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Default values
INSERT INTO config (`key`, value) VALUES
  ('target_track_count', '50'),
  ('youtube_playlist_id', '');
