CREATE TABLE `game_review_flags` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`game_id` text NOT NULL,
	`reason` text NOT NULL,
	`detail` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')) NOT NULL,
	FOREIGN KEY (`game_id`) REFERENCES `games`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_review_flags_game` ON `game_review_flags` (`game_id`);--> statement-breakpoint
CREATE TABLE `games` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`steam_appid` integer,
	`onboarding_phase` text DEFAULT 'draft' NOT NULL,
	`published` integer DEFAULT false NOT NULL,
	`tracklist_source` text,
	`yt_playlist_id` text,
	`thumbnail_url` text,
	`needs_review` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_games_created` ON `games` (`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_games_steam_appid` ON `games` (`steam_appid`) WHERE steam_appid IS NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_games_published` ON `games` (`published`);--> statement-breakpoint
CREATE INDEX `idx_games_onboarding` ON `games` (`onboarding_phase`);--> statement-breakpoint
CREATE TABLE `libraries` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_libraries_user` ON `libraries` (`user_id`);--> statement-breakpoint
CREATE TABLE `library_games` (
	`library_id` text NOT NULL,
	`game_id` text NOT NULL,
	`curation` text DEFAULT 'include' NOT NULL,
	`added_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')) NOT NULL,
	PRIMARY KEY(`library_id`, `game_id`),
	FOREIGN KEY (`library_id`) REFERENCES `libraries`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`game_id`) REFERENCES `games`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_library_games_game` ON `library_games` (`game_id`);--> statement-breakpoint
CREATE INDEX `idx_library_games_lib_curation` ON `library_games` (`library_id`,`curation`,`added_at`);--> statement-breakpoint
CREATE TABLE `playlist_track_decisions` (
	`playlist_id` text NOT NULL,
	`position` integer NOT NULL,
	`arc_phase` text NOT NULL,
	`game_id` text NOT NULL,
	`track_video_id` text NOT NULL,
	`score_role` real DEFAULT 0 NOT NULL,
	`score_mood` real DEFAULT 0 NOT NULL,
	`score_inst` real DEFAULT 0 NOT NULL,
	`score_view_bias` real DEFAULT 0 NOT NULL,
	`final_score` real DEFAULT 0 NOT NULL,
	`adjusted_score` real DEFAULT 0 NOT NULL,
	`pool_size` integer DEFAULT 0 NOT NULL,
	`game_budget` integer DEFAULT 0 NOT NULL,
	`game_budget_used` integer DEFAULT 0 NOT NULL,
	`selection_pass` text DEFAULT 'scored' NOT NULL,
	`rubric_used` integer DEFAULT false NOT NULL,
	`view_bias_active` integer DEFAULT false NOT NULL,
	PRIMARY KEY(`playlist_id`, `position`),
	FOREIGN KEY (`playlist_id`) REFERENCES `playlists`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `playlist_tracks` (
	`id` text PRIMARY KEY NOT NULL,
	`playlist_id` text NOT NULL,
	`game_id` text NOT NULL,
	`track_name` text,
	`video_id` text,
	`video_title` text,
	`channel_title` text,
	`thumbnail` text,
	`search_queries` text,
	`duration_seconds` integer,
	`position` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`error_message` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')) NOT NULL,
	`synced_at` text,
	FOREIGN KEY (`playlist_id`) REFERENCES `playlists`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`game_id`) REFERENCES `games`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_tracks_playlist` ON `playlist_tracks` (`playlist_id`);--> statement-breakpoint
CREATE INDEX `idx_tracks_game` ON `playlist_tracks` (`game_id`);--> statement-breakpoint
CREATE INDEX `idx_tracks_position` ON `playlist_tracks` (`position`);--> statement-breakpoint
CREATE INDEX `idx_tracks_status` ON `playlist_tracks` (`status`);--> statement-breakpoint
CREATE INDEX `idx_pt_playlist_status` ON `playlist_tracks` (`playlist_id`,`status`);--> statement-breakpoint
CREATE TABLE `playlists` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`is_archived` integer DEFAULT false NOT NULL,
	`rubric` text,
	`game_budgets` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_playlists_user` ON `playlists` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_playlists_created` ON `playlists` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_playlists_user_archived` ON `playlists` (`user_id`,`is_archived`,`created_at`);--> statement-breakpoint
CREATE TABLE `tracks` (
	`game_id` text NOT NULL,
	`name` text NOT NULL,
	`position` integer NOT NULL,
	`duration_seconds` integer,
	`energy` integer,
	`roles` text,
	`moods` text,
	`instrumentation` text,
	`has_vocals` integer,
	`active` integer DEFAULT true NOT NULL,
	`discovered` text,
	`tagged_at` text,
	PRIMARY KEY(`game_id`, `name`),
	FOREIGN KEY (`game_id`) REFERENCES `games`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_tracks_game_active` ON `tracks` (`game_id`,`active`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`username` text,
	`is_generating` integer DEFAULT false NOT NULL,
	`last_generated_at` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE TABLE `video_tracks` (
	`video_id` text NOT NULL,
	`game_id` text NOT NULL,
	`track_name` text,
	`duration_seconds` integer,
	`view_count` integer,
	`aligned_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')) NOT NULL,
	PRIMARY KEY(`video_id`, `game_id`),
	FOREIGN KEY (`game_id`) REFERENCES `games`(`id`) ON UPDATE no action ON DELETE cascade
);
