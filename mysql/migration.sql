-- BGMancer: MySQL schema
-- Run once in your local MySQL database:
--   mysql -u root -p bgmancer < mysql/migration.sql
-- Or paste into your MySQL client (TablePlus, DBeaver, etc.)

CREATE DATABASE IF NOT EXISTS bgmancer
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE bgmancer;

CREATE TABLE IF NOT EXISTS games (
  id              VARCHAR(36)  NOT NULL PRIMARY KEY,
  title           TEXT         NOT NULL,
  vibe_preference VARCHAR(50)  NOT NULL,
  current_video_id VARCHAR(50) DEFAULT NULL,
  video_title     TEXT         DEFAULT NULL,
  channel_title   TEXT         DEFAULT NULL,
  video_thumbnail TEXT         DEFAULT NULL,
  search_queries  JSON         DEFAULT NULL,
  status          VARCHAR(20)  NOT NULL DEFAULT 'pending',
  error_message   TEXT         DEFAULT NULL,
  created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
