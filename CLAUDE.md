# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm dev          # Start dev server (Turbopack, port 6959)
pnpm build        # Production build
pnpm lint         # ESLint
pnpm lint:fix     # ESLint with auto-fix
pnpm format       # Prettier (write)
pnpm format:check # Prettier (check only)
pnpm test         # Run all tests (Vitest)
pnpm test:watch   # Tests in watch mode
pnpm test:coverage # Tests with coverage report
pnpm db:generate  # Generate migration from schema diff
pnpm db:migrate   # Apply pending migrations (standalone)
pnpm db:studio    # Open Drizzle Studio (browser DB inspector)
pnpm db:reset     # Drop and recreate the database
```

Tests run via Vitest. Lint and format run automatically via husky pre-commit on staged `.ts`/`.tsx` files.

## Environment

All env vars are centralized in `src/lib/env.ts` — a typed singleton that validates at startup. Never use `process.env` directly; import `env` from `@/lib/env` instead.

Requires a `.env.local` (copy from `.env.local.example`) with:

- `NEXTAUTH_SECRET` — **required**; signs NextAuth sessions. Must not be a known insecure value. Generate with `openssl rand -base64 32`
- `YOUTUBE_API_KEY` — required for all playlist generation
- `STEAM_API_KEY` — required for Steam import
- `ANTHROPIC_API_KEY` — required; powers all LLM calls (tagging, vibe profiling)
- `ANTHROPIC_TAGGING_MODEL` — optional; override Anthropic model for Phase 2 tagging (defaults to `ANTHROPIC_MODEL`)
- `ANTHROPIC_VIBE_MODEL` — optional; override Anthropic model for Vibe Profiler (defaults to `ANTHROPIC_MODEL`)
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — required in production for Google OAuth sign-in. In local dev, a Credentials provider is used instead
- Backstage (`/backstage/*`) is open in local dev. In production, it's gated by Cloudflare Access on `bgmancer.com/backstage*`

The DB file is `bgmancer.db` at the project root (or override with `SQLITE_PATH`). Schema is managed by Drizzle ORM with migrations applied automatically on first run via `migrate()` in `src/lib/db/index.ts`.

## Architecture

### Authentication & Security

**Auth system:** NextAuth v5 (beta) as the sole auth provider. In dev, a Credentials provider allows sign-in with any name. In production, Google OAuth.

**User model:** Two modes — Guest (unauthenticated) and Logged-in (Google OAuth). No tier column; the distinction is purely session-based. Users are created in the DB on first OAuth sign-in via `Users.createFromOAuth()`.

**Route auth config (`src/lib/route-config.ts`):** Single source of truth — every accessible route (pages and API) must be registered here. Unregistered routes return 404. Each entry declares its auth level: `Public`, `Optional`, `Required`, or `Admin`.

**Middleware (`src/middleware.ts`):** Runs on all non-static requests. Reads the route config and enforces: (1) allowlist — unregistered routes get 404, (2) admin routes — in production, blocks backstage access from unexpected hosts as defense in depth behind Cloudflare Access. Uses the deprecated `middleware.ts` convention (not Next.js 16's `proxy.ts`) for `@opennextjs/cloudflare` compatibility.

**Route wrappers (`src/lib/services/route-wrappers.ts`):** `withRequiredAuth(handler, label)` and `withOptionalAuth(handler, label)` enforce user auth at the handler level. The proxy can't call `auth()` (NextAuth doesn't work in the proxy layer), so user auth is enforced here.

**Auth helpers (`src/lib/services/auth-helpers.ts`):** `getAuthSession()`, `getAuthUserId()`, `AuthRequiredError`. Used by route wrappers and custom handlers (generate, sync).

**Ownership checks:** Mutation routes for sessions and playlist tracks verify the resource belongs to the requesting user (403 on mismatch).

**Input validation:** All POST/PATCH/DELETE routes validate bodies with Zod schemas defined in `src/lib/validation.ts`.

**Rate limiting:** Guest generation is IP-rate-limited via `src/lib/rate-limit.ts` (in-memory sliding window). Authenticated users have a DB-backed generation cooldown lock.

**Guest vs Logged-in behavior:**

| Feature                  | Guest                          | Logged-in                                           |
| ------------------------ | ------------------------------ | --------------------------------------------------- |
| Browse catalog           | Yes                            | Yes                                                 |
| Generate playlist        | Director-only, no persistence  | Full pipeline (Vibe Profiler + Director), persisted |
| Import YouTube playlist  | Returns tracks, no persistence | Persisted as session                                |
| Game library             | No                             | DB-backed                                           |
| Session history          | No                             | DB-backed                                           |
| Reroll / Sync to YouTube | No                             | Yes                                                 |

When adding a new API route:

1. Add it to `src/lib/route-config.ts` with the correct `AuthLevel`
2. Use `withRequiredAuth` or `withOptionalAuth` wrapper
3. Add a Zod schema in `src/lib/validation.ts` if it accepts a body
4. Add ownership checks if it operates on user-specific resources

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

The local dev seed uses stable UUIDs: `LOCAL_USER_ID` and `LOCAL_LIBRARY_ID` (defined in `src/lib/db/seed.ts`). In production, users are created via `Users.createFromOAuth()` on first Google OAuth sign-in.

### Playlist generation pipeline (`src/lib/pipeline/`)

Two entry points in `src/lib/pipeline/index.ts`:

- `generatePlaylist(send, userId, config)` — authenticated users, full pipeline with Vibe Profiler + persistence
- `generatePlaylistForGuest(send, gameSelections, config)` — guests, Director-only, no Vibe Profiler, no persistence

Both called from `POST /api/playlist/generate`, which wraps them in an SSE stream (using the shared `makeSSEStream` factory in `src/lib/sse.ts`).

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

All under `src/app/api/`. Auth levels are defined in `src/lib/route-config.ts`. Key routes:

- `POST /api/playlist/generate` — SSE stream; runs the pipeline (Optional — guests get Director-only)
- `GET /api/games` — user's game library (Optional — guests get `[]`)
- `POST/PATCH/DELETE /api/games` — game library mutations (Required)
- `GET /api/games/catalog` — published game catalog (Public)
- `POST /api/playlist/import` — import tracks from a YouTube playlist (Optional — guests get no persistence)
- `GET /api/playlist` — fetch tracks (Optional — guests get `[]`)
- `DELETE /api/playlist` — clear playlist (Required)
- `PATCH /api/playlist` — reorder tracks (Optional — guests get silent 200)
- `DELETE /api/playlist/[id]` — remove a track (Required + ownership)
- `POST /api/playlist/[id]/reroll` — reroll a single track (Required + ownership)
- `GET /api/sessions` — session list (Optional — guests get `[]`)
- `PATCH/DELETE /api/sessions/[id]` — session management (Required + ownership)
- `POST /api/sync` — sync playlist to YouTube account (Required + OAuth access token)
- `GET /api/steam/games` / `GET /api/steam/search` / `POST /api/steam/import` — Steam lookups for game onboarding (Admin)

Backstage API routes (all under `src/app/api/backstage/`, auth level: Admin via wildcard):

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
2. Run `pnpm db:generate` — diffs against the latest snapshot and produces a new `.sql` migration file
3. Run `pnpm db:reset` — deletes the DB; next app start applies all migrations from scratch

While there are no production users, you can collapse to a single migration by deleting `drizzle/migrations/` and re-running `pnpm db:generate`. Once there is real user data, use incremental migrations instead.

### Review flags

Games can be flagged for manual review via `ReviewFlags.markAsNeedsReview(gameId, reason, detail?)` in `repos/review-flags.ts`. This sets `games.needs_review = 1` and inserts a row into `game_review_flags`. The pipeline raises flags when it encounters bad data (e.g. no usable tracks, playlist not found). Backstage shows these and lets the operator clear them after correcting the metadata.

## Key constraints

- **Never use `process.env` directly** — use the typed `env` singleton from `@/lib/env`
- **Every route must be in `src/lib/route-config.ts`** — unregistered routes return 404 via the proxy
- **Next.js 16 with OpenNext Cloudflare MUST use `middleware.ts`** — `proxy.ts` is not yet supported by `@opennextjs/cloudflare`
- `process.env.NODE_ENV` does **not** work reliably in client components with Turbopack — avoid conditional rendering based on it. Use `env.isDev` on the server instead
- `useEffect` must be placed **after** all `const` variables it references (temporal dead zone issue in this codebase's hook patterns)
- Sessions are FIFO-evicted: at most `MAX_PLAYLIST_SESSIONS` (3) sessions are kept per user; the oldest is deleted automatically
- YouTube OST playlist IDs are cached on the `games.yt_playlist_id` column to minimize API quota usage
