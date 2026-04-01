CREATE INDEX `idx_games_needs_review` ON `games` (`needs_review`);--> statement-breakpoint
CREATE INDEX `idx_tracks_tagged_at` ON `tracks` (`tagged_at`);--> statement-breakpoint
CREATE INDEX `idx_video_tracks_game_track` ON `video_tracks` (`game_id`,`track_name`);