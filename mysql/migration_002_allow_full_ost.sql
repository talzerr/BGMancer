-- Migration 002: add allow_full_ost flag to games
-- Run: mysql -h 127.0.0.1 -u root -p bgmancer < mysql/migration_002_allow_full_ost.sql

USE bgmancer;

ALTER TABLE games
  ADD COLUMN allow_full_ost BOOLEAN NOT NULL DEFAULT FALSE
  AFTER vibe_preference;
