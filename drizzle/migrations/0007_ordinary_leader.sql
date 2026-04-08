CREATE TABLE `user_steam_games` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`steam_app_id` integer NOT NULL,
	`playtime_minutes` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_user_steam_games_user_app` ON `user_steam_games` (`user_id`,`steam_app_id`);--> statement-breakpoint
ALTER TABLE `users` ADD `steam_id` text;--> statement-breakpoint
ALTER TABLE `users` ADD `steam_synced_at` text;