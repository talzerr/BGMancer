DROP INDEX `idx_tracks_status`;--> statement-breakpoint
DROP INDEX `idx_pt_playlist_status`;--> statement-breakpoint
ALTER TABLE `playlist_tracks` DROP COLUMN `search_queries`;--> statement-breakpoint
ALTER TABLE `playlist_tracks` DROP COLUMN `status`;--> statement-breakpoint
ALTER TABLE `playlist_tracks` DROP COLUMN `error_message`;