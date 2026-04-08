CREATE TABLE `game_requests` (
	`igdb_id` integer PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`cover_url` text,
	`request_count` integer DEFAULT 1 NOT NULL,
	`acknowledged` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_game_requests_ack_count` ON `game_requests` (`acknowledged`,`request_count`);