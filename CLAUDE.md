# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start dev server (Turbopack, port 6959)
npm run build        # Production build
npm run lint         # ESLint
npm run lint:fix     # ESLint with auto-fix
npm run format       # Prettier (write)
npm run format:check # Prettier (check only)
npm run test         # Run all tests (Vitest)
npm run test:watch   # Tests in watch mode
npm run test:coverage # Tests with coverage report
npm run db:generate  # Generate migration from schema diff
npm run db:migrate   # Apply pending migrations (standalone)
npm run db:studio    # Open Drizzle Studio (browser DB inspector)
npm run db:reset     # Drop and recreate the database
npm run db:backup    # Snapshot the database
npm run db:restore   # Restore from snapshot
```

Tests run via Vitest. Lint and format run automatically via husky pre-commit on staged `.ts`/`.tsx` files.

## Environment

Requires a `.env.local` (copy from `.env.local.example`) with:

- `YOUTUBE_API_KEY` — required for all playlist generation
- `STEAM_API_KEY` — required for Steam import
- `ANTHROPIC_API_KEY` — required; powers all LLM calls (tagging, vibe profiling)
- `ANTHROPIC_TAGGING_MODEL` — optional; override Anthropic model for Phase 2 tagging (defaults to `ANTHROPIC_MODEL`)
- `ANTHROPIC_VIBE_MODEL` — optional; override Anthropic model for Vibe Profiler (defaults to `ANTHROPIC_MODEL`)
- `NEXTAUTH_SECRET` — required for next-auth sessions
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — optional; enables "Sync to YouTube"

The DB file is `bgmancer.db` at the project root (or override with `SQLITE_PATH`). Schema is managed by Drizzle ORM with migrations applied automatically on first run via `migrate()` in `src/lib/db/index.ts`.

## Architecture

### Pages and routing

Next.js App Router with three main page areas:

- `/` — main feed (`src/app/page.tsx` + `src/app/feed-client.tsx`) — playlist view, generation controls, session history
- `/library` — game library management (`src/app/library/page.tsx` + `src/app/library/library-client.tsx`)
- `/backstage` — admin control plane (`src/app/(backstage)/backstage/`) — inspect/correct track metadata, review flags, and Director telemetry. Three views:
  - `/backstage/games` — game list with needs-review badges, re-ingest / retag actions
  - `/backstage/tracks` — track lab: full tag table with inline editing via `TrackEditSheet`, bulk actions, re-tag trigger
  - `/backstage/theatre` — Director telemetry: per-session score breakdown and arc-phase audit trail

All non-backstage pages are wrapped by `PlayerProvider` (in `src/app/layout.tsx`), which manages global state via `src/context/player-context.tsx`. Backstage has its own layout (`BackstageLayout`) and does not use `PlayerProvider`.

### Global state (PlayerContext)

`PlayerProvider` composes four hooks and shares their state app-wide:

- `usePlaylist` — playlist tracks + session management, fetches from `/api/playlist`
- `usePlayerState` — playback state (current track, shuffle, play/pause)
- `useConfig` — app config (track count, anti-spoiler, etc.) stored in localStorage
- `useGameLibrary` — game library from `/api/games`

Use `usePlayerContext()` to access any of these from any client component.

### Database layer (`src/lib/db/`)

Uses **Drizzle ORM** with `better-sqlite3` as the local driver. All repo methods are **async** (returns `Promise<T>`) to prepare for Cloudflare D1 migration.

- `index.ts` — singleton `getDB()` returns a Drizzle instance, runs migrations on init, seeds default user
- `drizzle-schema.ts` — Drizzle schema definition for all tables, indexes, and foreign keys
- `repo.ts` — barrel re-export for all repos in `repos/`
- `repos/` — one file per domain: `games`, `backstage-games`, `users`, `sessions`, `playlist`, `tracks`, `video-tracks`, `review-flags`, `decisions`
- `mappers.ts` — row → typed object converters (used by repos that query via `sql` tagged template)
- `queries.ts` — shared Drizzle subquery helpers
- `seed.ts` — seeds the local dev user on first run
- `test-helpers.ts` — `createTestDrizzleDB()` for in-memory test databases

The local single-user setup uses stable UUIDs: `LOCAL_USER_ID` and `LOCAL_LIBRARY_ID` (defined in `src/lib/db/seed.ts`).

### Playlist generation pipeline (`src/lib/pipeline/`)

Entry point: `generatePlaylist(send, userId, config)` in `src/lib/pipeline/index.ts`. Called from `POST /api/playlist/generate`, which wraps it in an SSE stream (using the shared `makeSSEStream` factory in `src/lib/sse.ts`).

Four-phase process for individual-track games:

1. **Phase 1 — Playlist discovery** (`candidates.ts`): find (or search YouTube for) the OST playlist ID per game; cache result in `game_yt_playlists`.
2. **Phase 1.5 — Track resolution** (`resolver.ts`): align DB track names to YouTube video IDs via LLM; fall back to per-track YouTube search for unresolved tracks. Durations fetched and cached in `video_tracks`.
3. **Phase 2 — Vibe Profiler** (`vibe-profiler.ts`): LLM produces a `ScoringRubric` from the session's game titles. The rubric shapes the Director's scoring weights.
4. **Phase 3 — Deterministic arc assembly** (`director.ts`): the TypeScript Director builds the final ordered playlist from the tagged pool, shaping energy flow and cross-game balance. **No LLM involvement.** Each selected track produces a `TrackDecision` record (score components, arc phase, pool size, game budget) persisted via `DirectorDecisions.bulkInsert()` into `playlist_track_decisions` — this is the Director telemetry shown in the Theatre view.

Curation modes (see `CurationMode` enum in `src/types/index.ts`):

- `skip` — excluded from generation
- `lite` — half budget weight in phase 3
- `include` — standard (default)
- `focus` — guaranteed double-weighted budget in phase 3

**Game onboarding** (`onboarding.ts`): when a new game is added, `onboardGame()` is called in the background. It calls `ingestFromDiscogs()` — a shared helper that fetches the tracklist from Discogs, upserts tracks, and runs the LLM tagger. The Backstage reingest action also calls `ingestFromDiscogs()` after clearing existing data.

### LLM providers (`src/lib/llm/`)

`src/lib/llm/index.ts` exports:

- `getTaggingProvider()` — Phase 1.5 resolver + Phase 2 Tagger. Override model with `ANTHROPIC_TAGGING_MODEL`.
- `getVibeProfilerProvider()` — Phase 2 Vibe Profiler. Override model with `ANTHROPIC_VIBE_MODEL`.

All providers implement `LLMProvider` (`src/lib/llm/provider.ts`): `complete(system, user, opts)`. All LLM calls use Anthropic (`ANTHROPIC_API_KEY` required).

### Config system

Config is stored in **localStorage** (not the DB). `useConfig` (`src/hooks/useConfig.ts`) reads/writes via `localStorage` with the following keys:

| Key                        | Type       | Default | Purpose                                                |
| -------------------------- | ---------- | ------- | ------------------------------------------------------ |
| `bgm_target_track_count`   | number     | 50      | Target playlist length                                 |
| `bgm_anti_spoiler_enabled` | "1" \| "0" | "0"     | Blur unplayed track titles                             |
| `bgm_allow_long_tracks`    | "1" \| "0" | "0"     | Allow tracks >9min                                     |
| `bgm_allow_short_tracks`   | "1" \| "0" | "1"     | Allow tracks <90s (note: always false in practice)     |
| `bgm_raw_vibes`            | "1" \| "0" | "0"     | Disable view bias scoring — score on musical tags only |

There is no `/api/config` route. The hook uses `localStorage.getItem()` / `localStorage.setItem()` directly with boolean parsing via `v === "1"`. To add a new config key:

1. Add an `lsGet`/`lsSet` call in `useConfig.ts`
2. Update state and return from the hook
3. Expose getter/setter for the new key in the hook's return object

Config persists across sessions and is independent of user identity (all users share the same browser localStorage).

### API routes

All under `src/app/api/`. Key routes:

- `POST /api/playlist/generate` — SSE stream; runs the pipeline
- `GET/POST/DELETE /api/games` — game library CRUD
- `POST /api/steam/import` — bulk Steam library import
- `POST /api/playlist/import` — import tracks from a YouTube playlist URL
- `GET /api/playlist` / `GET /api/playlist/[id]` — fetch tracks (active or by session ID)
- `POST /api/playlist/[id]/reroll` — reroll a single track
- `GET/POST/DELETE /api/sessions/[id]` — session management
- `POST /api/sync` — sync playlist to YouTube account

Backstage API routes (all under `src/app/api/backstage/`):

- `GET /api/backstage/games` — paginated game list with needs-review flag
- `GET /api/backstage/games/[gameId]/tracks` — tracks for a single game
- `POST /api/backstage/reingest` — clear tracks and re-ingest from Discogs + retag; streams SSE progress
- `POST /api/backstage/retag` — clear tags and re-run the LLM tagger for a game; streams SSE progress
- `GET/POST/DELETE /api/backstage/review-flags` — manage per-game review flags
- `GET /api/backstage/tracks` — full track table with tag metadata
- `GET /api/backstage/theatre/sessions` — session list for Theatre view
- `GET /api/backstage/theatre/[playlistId]` — full telemetry for one playlist (tracks + decisions + budgets + rubric)

## Code style

- Use `enum` for all named value sets — not string literal union types (`type Foo = "a" | "b"`). See `CurationMode`, `TrackMood`, `TrackInstrumentation` as the established pattern.

## Schema changes

Schema is defined in `src/lib/db/drizzle-schema.ts` using Drizzle's SQLite schema builders. Migrations are managed by Drizzle Kit and stored in `drizzle/migrations/`.

**Workflow:**

1. Edit `src/lib/db/drizzle-schema.ts`
2. Run `npm run db:generate` — diffs against the latest snapshot and produces a new `.sql` migration file
3. Run `npm run db:reset` — deletes the DB; next app start applies all migrations from scratch

While there are no production users, you can collapse to a single migration by deleting `drizzle/migrations/` and re-running `npm run db:generate`. Once there is real user data, use incremental migrations instead.

### Review flags

Games can be flagged for manual review via `ReviewFlags.markAsNeedsReview(gameId, reason, detail?)` in `repos/review-flags.ts`. This sets `games.needs_review = 1` and inserts a row into `game_review_flags`. The pipeline raises flags when it encounters bad data (e.g. no usable tracks, playlist not found). Backstage shows these and lets the operator clear them after correcting the metadata.

## Key constraints

- `process.env.NODE_ENV` does **not** work reliably in client components with Turbopack — avoid conditional rendering based on it
- `useEffect` must be placed **after** all `const` variables it references (temporal dead zone issue in this codebase's hook patterns)
- Sessions are FIFO-evicted: at most `MAX_PLAYLIST_SESSIONS` (3) sessions are kept per user; the oldest is deleted automatically
- YouTube OST playlist IDs are cached on the `games.yt_playlist_id` column to minimize API quota usage
