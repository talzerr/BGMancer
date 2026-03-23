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
npm run db:reset     # Drop and recreate the database
npm run db:backup    # Snapshot the database
npm run db:restore   # Restore from snapshot
```

There are no automated tests. Lint and format run automatically via husky pre-commit on staged `.ts`/`.tsx` files.

## Environment

Requires a `.env.local` (copy from `.env.local.example`) with:

- `YOUTUBE_API_KEY` — required for all playlist generation
- `STEAM_API_KEY` — required for Steam import
- `ANTHROPIC_API_KEY` — optional; enables Maestro tier (Claude) instead of Bard (Ollama)
- `ANTHROPIC_TAGGING_MODEL` — optional; override Anthropic model for Phase 2 tagging (defaults to `ANTHROPIC_MODEL`)
- `ANTHROPIC_VIBE_MODEL` — optional; override Anthropic model for Vibe Check (defaults to `ANTHROPIC_MODEL`)
- `NEXTAUTH_SECRET` — required for next-auth sessions
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — optional; enables "Sync to YouTube"
- `OLLAMA_HOST` / `OLLAMA_MODEL` — optional; defaults to `http://localhost:11434` / `llama3.2`

The DB file is `bgmancer.db` at the project root (or override with `SQLITE_PATH`). Schema is auto-created on first run via `initSchema()` in `src/lib/db/index.ts` — there is no migration system; the schema is idempotent (`CREATE TABLE IF NOT EXISTS`).

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

- `index.ts` — singleton `getDB()`, schema init, seed functions
- `repo.ts` — barrel re-export for all repos in `repos/`
- `repos/` — one file per domain: `games`, `users`, `sessions`, `playlist`, `tracks`, `video-tracks`, `review-flags`, `decisions`
- `mappers.ts` — raw SQLite row → typed object converters

Statements are cached via the `stmt()` helper in `repos/_shared.ts` to avoid repeated `db.prepare()` calls.

The local single-user setup uses stable UUIDs: `LOCAL_USER_ID` and `LOCAL_LIBRARY_ID` (defined in `src/lib/db/index.ts`). All game queries filter by `LOCAL_LIBRARY_SQ` — a subquery that resolves the local user's library.

On startup, `syncYtPlaylistSeeds()` upserts `data/yt-playlists.json` into `game_yt_playlists` for any matching games. This can emit FK warnings for titles not yet in the DB — this is harmless.

### Playlist generation pipeline (`src/lib/pipeline/`)

Entry point: `generatePlaylist(send, userId, config)` in `src/lib/pipeline/index.ts`. Called from `POST /api/playlist/generate`, which wraps it in an SSE stream.

Three-phase process for individual-track games:

1. **Phase 1 — Playlist discovery** (`candidates.ts`): find (or load from `game_yt_playlists` cache) the YouTube OST playlist ID per game
2. **Phase 2 — Per-game track tagging** (`tagger.ts`): the Tagger LLM enriches each track with `energy`, `role`, `cleanName`, and junk detection. Results are cached in `track_tags` DB table.
3. **Phase 3 — Deterministic arc assembly** (`director.ts`): the TypeScript Director builds the final ordered playlist from the tagged pool, shaping energy flow and cross-game balance. **No LLM involvement.** Each selected track produces a `TrackDecision` record (score components, arc phase, pool size, game budget) persisted via `DirectorDecisions.bulkInsert()` into `playlist_track_decisions` — this is the Director telemetry shown in the Theatre view.

Between phases 2 and 3, **Vibe Check** (`vibe-check.ts`, Maestro only) scores a 2.5× candidate sample with an LLM to produce `fitScore` values; the Director weights these during arc assembly. `casting.ts` builds the candidate pool for Vibe Check.

Curation modes (see `CurationMode` enum in `src/types/index.ts`):

- `skip` — excluded from generation
- `lite` — half budget weight in phase 3
- `include` — standard (default)
- `focus` — guaranteed double-weighted budget in phase 3

Full-OST games (`allow_full_ost = true`) bypass all phases — one YouTube compilation video per game.

### LLM providers (`src/lib/llm/`)

`src/lib/llm/index.ts` exports:

- `getTaggingProvider(tier)` — Phase 1.5 resolver + Phase 2 Tagger; Anthropic if Maestro + key set, else Ollama. Override model with `ANTHROPIC_TAGGING_MODEL`.
- `getLocalLLMProvider()` — always returns Ollama (used for name cleaning and Bard tier).

All providers implement `LLMProvider` (`src/lib/llm/provider.ts`): `complete(system, user, opts)`.

Tier summary:

- `Bard` — always Ollama
- `Maestro` — Anthropic when `ANTHROPIC_API_KEY` is set, falls back to Ollama

### Config system

Config is stored in **localStorage** (not the DB). `useConfig` (`src/hooks/useConfig.ts`) reads/writes via `localStorage` with the following keys:

| Key                        | Type       | Default | Purpose                                            |
| -------------------------- | ---------- | ------- | -------------------------------------------------- |
| `bgm_target_track_count`   | number     | 20      | Target playlist length                             |
| `bgm_anti_spoiler_enabled` | "1" \| "0" | "0"     | Blur unplayed track titles                         |
| `bgm_allow_long_tracks`    | "1" \| "0" | "0"     | Allow tracks >9min                                 |
| `bgm_allow_short_tracks`   | "1" \| "0" | "1"     | Allow tracks <90s (note: always false in practice) |

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
- `POST /api/backstage/reingest` — re-run Phase 1 (playlist discovery) for a game
- `POST /api/backstage/retag` — re-run Phase 2 (tagger) for a game; streams SSE progress
- `GET/POST/DELETE /api/backstage/review-flags` — manage per-game review flags
- `GET /api/backstage/tracks` — full track table with tag metadata
- `GET /api/backstage/theatre/sessions` — session list for Theatre view
- `GET /api/backstage/theatre/[playlistId]` — full telemetry for one playlist (tracks + decisions + budgets + rubric)

## Code style

- Use `enum` for all named value sets — not string literal union types (`type Foo = "a" | "b"`). See `CurationMode`, `UserTier`, `TrackMood`, `TrackInstrumentation` as the established pattern.

## Schema changes

No migration system. There are no production users, so any schema change should be made directly in `src/lib/db/schema.ts` (in the `CREATE TABLE` definition) and applied with `npm run db:reset`. Never use `ALTER TABLE` — just update the schema and reset.

### Review flags

Games can be flagged for manual review via `ReviewFlags.markAsNeedsReview(gameId, reason, detail?)` in `repos/review-flags.ts`. This sets `games.needs_review = 1` and inserts a row into `game_review_flags`. The pipeline raises flags when it encounters bad data (e.g. no usable tracks, playlist not found). Backstage shows these and lets the operator clear them after correcting the metadata.

## Key constraints

- `process.env.NODE_ENV` does **not** work reliably in client components with Turbopack — avoid conditional rendering based on it
- `useEffect` must be placed **after** all `const` variables it references (temporal dead zone issue in this codebase's hook patterns)
- Sessions are FIFO-evicted: at most `MAX_PLAYLIST_SESSIONS` (3) sessions are kept per user; the oldest is deleted automatically
- YouTube OST playlist IDs are cached in `game_yt_playlists` to minimize API quota usage
