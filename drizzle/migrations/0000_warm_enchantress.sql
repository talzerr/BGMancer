CREATE TABLE "game_requests" (
	"igdb_id" integer PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"cover_url" text,
	"request_count" integer DEFAULT 1 NOT NULL,
	"acknowledged" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "game_review_flags" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "game_review_flags_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"game_id" text NOT NULL,
	"reason" text NOT NULL,
	"detail" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "games" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"steam_appid" integer,
	"onboarding_phase" text DEFAULT 'draft' NOT NULL,
	"published" boolean DEFAULT false NOT NULL,
	"tracklist_source" text,
	"yt_playlist_id" text,
	"thumbnail_url" text,
	"needs_review" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "libraries" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "library_games" (
	"library_id" text NOT NULL,
	"game_id" text NOT NULL,
	"curation" text DEFAULT 'include' NOT NULL,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "library_games_library_id_game_id_pk" PRIMARY KEY("library_id","game_id")
);
--> statement-breakpoint
CREATE TABLE "playlist_track_decisions" (
	"playlist_id" text NOT NULL,
	"position" integer NOT NULL,
	"arc_phase" text NOT NULL,
	"game_id" text NOT NULL,
	"track_video_id" text NOT NULL,
	"score_role" real DEFAULT 0 NOT NULL,
	"score_mood" real DEFAULT 0 NOT NULL,
	"score_inst" real DEFAULT 0 NOT NULL,
	"score_view_bias" real DEFAULT 0 NOT NULL,
	"final_score" real DEFAULT 0 NOT NULL,
	"adjusted_score" real DEFAULT 0 NOT NULL,
	"pool_size" integer DEFAULT 0 NOT NULL,
	"game_budget" integer DEFAULT 0 NOT NULL,
	"game_budget_used" integer DEFAULT 0 NOT NULL,
	"selection_pass" text DEFAULT 'scored' NOT NULL,
	CONSTRAINT "playlist_track_decisions_playlist_id_position_pk" PRIMARY KEY("playlist_id","position")
);
--> statement-breakpoint
CREATE TABLE "playlist_tracks" (
	"id" text PRIMARY KEY NOT NULL,
	"playlist_id" text NOT NULL,
	"game_id" text NOT NULL,
	"track_name" text,
	"video_id" text,
	"video_title" text,
	"channel_title" text,
	"thumbnail" text,
	"duration_seconds" integer,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"synced_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "playlists" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"is_archived" boolean DEFAULT false NOT NULL,
	"playlist_mode" text DEFAULT 'journey' NOT NULL,
	"rubric" jsonb,
	"game_budgets" jsonb,
	"youtube_playlist_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tracks" (
	"game_id" text NOT NULL,
	"name" text NOT NULL,
	"position" integer NOT NULL,
	"energy" integer,
	"roles" jsonb,
	"moods" jsonb,
	"instrumentation" jsonb,
	"has_vocals" integer,
	"active" boolean DEFAULT true NOT NULL,
	"discovered" text,
	"tagged_at" timestamp with time zone,
	CONSTRAINT "tracks_game_id_name_pk" PRIMARY KEY("game_id","name")
);
--> statement-breakpoint
CREATE TABLE "user_steam_games" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "user_steam_games_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" text NOT NULL,
	"steam_app_id" integer NOT NULL,
	"playtime_minutes" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"username" text,
	"steam_id" text,
	"steam_synced_at" timestamp with time zone,
	"is_generating" boolean DEFAULT false NOT NULL,
	"last_generated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "video_tracks" (
	"video_id" text NOT NULL,
	"game_id" text NOT NULL,
	"track_name" text,
	"duration_seconds" integer,
	"view_count" integer,
	"aligned_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "video_tracks_video_id_game_id_pk" PRIMARY KEY("video_id","game_id")
);
--> statement-breakpoint
ALTER TABLE "game_review_flags" ADD CONSTRAINT "game_review_flags_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "libraries" ADD CONSTRAINT "libraries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "library_games" ADD CONSTRAINT "library_games_library_id_libraries_id_fk" FOREIGN KEY ("library_id") REFERENCES "public"."libraries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "library_games" ADD CONSTRAINT "library_games_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "playlist_track_decisions" ADD CONSTRAINT "playlist_track_decisions_playlist_id_playlists_id_fk" FOREIGN KEY ("playlist_id") REFERENCES "public"."playlists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "playlist_tracks" ADD CONSTRAINT "playlist_tracks_playlist_id_playlists_id_fk" FOREIGN KEY ("playlist_id") REFERENCES "public"."playlists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "playlist_tracks" ADD CONSTRAINT "playlist_tracks_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "playlists" ADD CONSTRAINT "playlists_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tracks" ADD CONSTRAINT "tracks_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_steam_games" ADD CONSTRAINT "user_steam_games_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_tracks" ADD CONSTRAINT "video_tracks_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_game_requests_ack_count" ON "game_requests" USING btree ("acknowledged","request_count");--> statement-breakpoint
CREATE INDEX "idx_review_flags_game" ON "game_review_flags" USING btree ("game_id");--> statement-breakpoint
CREATE INDEX "idx_games_created" ON "games" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_games_steam_appid" ON "games" USING btree ("steam_appid") WHERE steam_appid IS NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_games_published" ON "games" USING btree ("published");--> statement-breakpoint
CREATE INDEX "idx_games_onboarding" ON "games" USING btree ("onboarding_phase");--> statement-breakpoint
CREATE INDEX "idx_games_needs_review" ON "games" USING btree ("needs_review");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_libraries_user" ON "libraries" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_library_games_game" ON "library_games" USING btree ("game_id");--> statement-breakpoint
CREATE INDEX "idx_library_games_lib_curation" ON "library_games" USING btree ("library_id","curation","added_at");--> statement-breakpoint
CREATE INDEX "idx_tracks_playlist" ON "playlist_tracks" USING btree ("playlist_id");--> statement-breakpoint
CREATE INDEX "idx_tracks_game" ON "playlist_tracks" USING btree ("game_id");--> statement-breakpoint
CREATE INDEX "idx_tracks_position" ON "playlist_tracks" USING btree ("position");--> statement-breakpoint
CREATE INDEX "idx_playlists_user" ON "playlists" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_playlists_created" ON "playlists" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_playlists_user_archived" ON "playlists" USING btree ("user_id","is_archived","created_at");--> statement-breakpoint
CREATE INDEX "idx_tracks_game_active" ON "tracks" USING btree ("game_id","active");--> statement-breakpoint
CREATE INDEX "idx_tracks_tagged_at" ON "tracks" USING btree ("tagged_at");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_user_steam_games_user_app" ON "user_steam_games" USING btree ("user_id","steam_app_id");--> statement-breakpoint
CREATE INDEX "idx_video_tracks_game_track" ON "video_tracks" USING btree ("game_id","track_name");