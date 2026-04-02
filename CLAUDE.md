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
pnpm db:migrate   # Apply pending migrations to local D1
pnpm db:studio    # Open Drizzle Studio (browser DB inspector)
pnpm db:reset     # Wipe local D1 state (run db:migrate after)
pnpm preview      # Build + preview in Cloudflare Workers runtime
```

Tests run via Vitest. Lint and format run automatically via husky pre-commit on staged `.ts`/`.tsx` files.

## Environment

All env vars are centralized in `src/lib/env.ts` — a typed lazy-loaded singleton. Never use `process.env` directly; import `env` from `@/lib/env` instead. In Cloudflare Workers, `env` is initialized on first access (not at module load time) because secrets are available per-request.

Requires a `.env.local` (copy from `.env.local.example`) with:

- `NEXTAUTH_SECRET` — **required**; signs NextAuth sessions. Must not be a known insecure value. Generate with `openssl rand -base64 32`
- `YOUTUBE_API_KEY` — required for all playlist generation
- `STEAM_API_KEY` — required for Steam import
- `ANTHROPIC_API_KEY` — required; powers all LLM calls (tagging, vibe profiling)
- `ANTHROPIC_TAGGING_MODEL` — optional; override Anthropic model for Phase 2 tagging (defaults to `ANTHROPIC_MODEL`)
- `ANTHROPIC_VIBE_MODEL` — optional; override Anthropic model for Vibe Profiler (defaults to `ANTHROPIC_MODEL`)
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — required in production for Google OAuth sign-in. In local dev, a Credentials provider is used instead
- Backstage (`/backstage/*`) is open in local dev. In production, it's gated by Cloudflare Access on `bgmancer.com/backstage*`

Schema is managed by Drizzle ORM with migrations stored in `drizzle/migrations/`. Locally, apply with `pnpm db:migrate`. In production, apply with `wrangler d1 migrations apply bgmancer-prod --remote`.

## Architecture

### Authentication & Security

**Auth system:** NextAuth v5 (beta) as the sole auth provider. In dev, a Credentials provider allows sign-in with any name. In production, Google OAuth.

**User model:** Two modes — Guest (unauthenticated) and Logged-in (Google OAuth). No tier column; the distinction is purely session-based. Users are created in the DB on first OAuth sign-in via `Users.createFromOAuth()`.

**Route auth config (`src/lib/route-config.ts`):** Single source of truth — every accessible route (pages and API) must be registered here. Unregistered routes return 404. Each entry declares its auth level: `Public`, `Optional`, `Required`, or `Admin`.

**Middleware (`src/middleware.ts`):** Runs on all non-static requests. Reads the route config and enforces: (1) allowlist — unregistered routes get 404, (2) admin routes — in production, requires `CF_Authorization` cookie (set by Cloudflare Access) as defense in depth. Uses the deprecated `middleware.ts` convention (not Next.js 16's `proxy.ts`) for `@opennextjs/cloudflare` compatibility.

**Route wrappers (`src/lib/services/route-wrappers.ts`):** `withRequiredAuth(handler, label)` and `withOptionalAuth(handler, label)` enforce user auth at the handler level. Middleware can't call `auth()` (NextAuth doesn't work in the middleware layer), so user auth is enforced here.

**Auth helpers (`src/lib/services/auth-helpers.ts`):** `getAuthSession()`, `getAuthUserId()`, `AuthRequiredError`. Used by route wrappers and custom handlers (generate, sync).

**Ownership checks:** Mutation routes for sessions and playlist tracks verify the resource belongs to the requesting user (403 on mismatch).

**Input validation:** All POST/PATCH/DELETE routes validate bodies with Zod schemas defined in `src/lib/validation.ts`.

**Rate limiting:** Guest generation is IP-rate-limited via `src/lib/rate-limit.ts` (KV-backed sliding window in production, in-memory in dev). Authenticated users have a DB-backed generation cooldown lock.

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

Uses **Drizzle ORM** with **Cloudflare D1** as the database driver everywhere (dev, staging, production). Local dev uses D1 emulation via miniflare (provided by `initOpenNextCloudflareForDev()` in `next.config.ts`). Tests use better-sqlite3 in-memory databases wrapped with a D1-compat layer.

- `index.ts` — `getDB()` returns a D1-backed Drizzle instance via `getCloudflareContext().env.DB`
- `drizzle-schema.ts` — Drizzle schema definition for all tables, indexes, and foreign keys
- `repo.ts` — barrel re-export for all repos in `repos/`
- `repos/` — one file per domain: `games`, `backstage-games`, `users`, `sessions`, `playlist`, `tracks`, `video-tracks`, `review-flags`, `decisions`
- `mappers.ts` — row → typed object converters (used by repos that query via `sql` tagged template)
- `queries.ts` — shared Drizzle subquery helpers
- `test-helpers.ts` — `createTestDrizzleDB()` for in-memory test databases with D1-compat wrapper

Users are created via `Users.createFromOAuth()` on first Google OAuth sign-in. In local dev, the Credentials provider creates users on the fly.

### Playlist generation pipeline (`src/lib/pipeline/`)

Two entry points in `src/lib/pipeline/index.ts`:

- `generatePlaylist(send, userId, config)` — authenticated users, full pipeline with Vibe Profiler + persistence
- `generatePlaylistForGuest(send, gameSelections, config)` — guests, Director-only, no Vibe Profiler, no persistence

Both called from `POST /api/playlist/generate`, which wraps them in an SSE stream (using the shared `makeSSEStream` factory in `src/lib/sse.ts`).

Three-phase process (all track data is pre-cached during backstage onboarding — no YouTube API or LLM calls needed for candidate loading):

1. **Candidate gathering** (`candidates.ts`): `getTaggedPool()` loads active, tagged tracks with pre-resolved video IDs from the `tracks` + `video_tracks` tables. Only tracks that are active, tagged (energy + roles), and have a resolved YouTube video are included.
2. **Vibe Profiler** (`vibe-profiler.ts`): LLM produces a `ScoringRubric` from the session's game titles. The rubric shapes the Director's scoring weights. Skipped in Express Mode (`skip_llm`) and for guests.
3. **Deterministic arc assembly** (`director.ts`): the TypeScript Director builds the final ordered playlist from the tagged pool, shaping energy flow and cross-game balance. **No LLM involvement.** Each selected track produces a `TrackDecision` record (score components, arc phase, pool size, game budget) persisted via `DirectorDecisions.bulkInsert()` into `playlist_track_decisions` — this is the Director telemetry shown in the Theatre view.

**Track reroll** (`POST /api/playlist/[id]/reroll`): picks a random replacement from the same backstage-curated pool (`getTaggedPool`), excluding tracks already in the current session. No YouTube API calls — everything from DB.

Curation modes (see `CurationMode` enum in `src/types/index.ts`):

- `skip` — excluded from generation
- `lite` — half budget weight in phase 3
- `include` — standard (default)
- `focus` — guaranteed double-weighted budget in phase 3

**Game onboarding** (`onboarding.ts`): backstage-driven process that prepares a game for playlist generation. Three phases:

1. **Load tracks** — fetch tracklist from Discogs, upsert into `tracks` table.
2. **Resolve videos** (`resolver.ts`) — align track names to YouTube video IDs via LLM playlist matching + fallback search; results cached in `video_tracks` table.
3. **Tag tracks** — LLM produces energy, roles, moods, instrumentation for each resolved track; stored in `tracks` table.

Only after all three phases complete is a game ready for the Director. The Backstage reingest action re-runs all phases; retag re-runs only phase 3.

### LLM providers (`src/lib/llm/`)

`src/lib/llm/index.ts` exports:

- `getTaggingProvider()` — Phase 1.5 resolver + Phase 2 Tagger. Override model with `ANTHROPIC_TAGGING_MODEL`.
- `getVibeProfilerProvider()` — Phase 2 Vibe Profiler. Override model with `ANTHROPIC_VIBE_MODEL`.

All providers implement `LLMProvider` (`src/lib/llm/provider.ts`): `complete(system, user, opts)`. All LLM calls use Anthropic (`ANTHROPIC_API_KEY` required).

### Config system

Config is stored in **localStorage** (not the DB). `useConfig` (`src/hooks/useConfig.ts`) reads/writes via `localStorage` with the following keys:

| Key                        | Type       | Default | Purpose                                                 |
| -------------------------- | ---------- | ------- | ------------------------------------------------------- |
| `bgm_target_track_count`   | number     | 50      | Target playlist length                                  |
| `bgm_anti_spoiler_enabled` | "1" \| "0" | "0"     | Blur unplayed track titles                              |
| `bgm_allow_long_tracks`    | "1" \| "0" | "0"     | Allow tracks >9min                                      |
| `bgm_allow_short_tracks`   | "1" \| "0" | "1"     | Allow tracks <90s (note: always false in practice)      |
| `bgm_raw_vibes`            | "1" \| "0" | "0"     | Disable view bias scoring — score on musical tags only  |
| `bgm_skip_llm`             | "1" \| "0" | "0"     | Express Mode — skip Vibe Profiler for faster generation |

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
3. Run `pnpm db:migrate` — applies migrations to local D1
4. For production: `wrangler d1 migrations apply bgmancer-prod --remote`
5. To start fresh locally: `pnpm db:reset` then `pnpm db:migrate`

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

## Deployment

The app runs on Cloudflare Workers via `@opennextjs/cloudflare`. Infrastructure is defined in `wrangler.jsonc`.

```bash
# Production
pnpm cf-typegen                                          # generate Cloudflare env types
pnpm opennextjs-cloudflare build                         # build for Workers
wrangler deploy                                          # deploy to production
wrangler d1 migrations apply bgmancer-prod --remote      # apply DB migrations

# Staging
wrangler deploy --env staging
wrangler d1 migrations apply bgmancer-staging --remote --env staging

# Secrets
wrangler secret put <NAME>                               # push a secret to production
wrangler secret put <NAME> --env staging                 # push a secret to staging

# Rollback
wrangler rollback                                        # revert to previous deployment

# Logs
wrangler tail                                            # live-stream Worker logs
```

The Cloudflare dashboard build command is: `pnpm cf-typegen && pnpm opennextjs-cloudflare build`
