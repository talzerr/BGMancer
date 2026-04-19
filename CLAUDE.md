# CLAUDE.md

Guidance for Claude Code working in this repo. Describes invariants and non-obvious decisions — the code itself is the source of truth for APIs and data shapes.

## Project

**BGMancer** is a video game soundtrack playlist generator. Users build a library of games and generate curated background music playlists played via YouTube. Four playlist modes (Journey / Chill / Mix / Rush). Guest and authenticated flows. Backstage admin for onboarding + metadata curation.

**Core value:** playlists feel intentionally curated, not random. The algorithmic layer (deterministic Director + LLM Vibe Profiler) is the craft moat.

**Stack (fixed):** Next.js 16 App Router · React 19 · TypeScript strict · Tailwind 4 · Drizzle ORM on Cloudflare D1 · NextAuth v5 · Anthropic SDK · Vitest · `@opennextjs/cloudflare`.

## Commands

```bash
pnpm dev            # port 6959, Turbopack
pnpm build          # production build
pnpm lint           # ESLint (lint:fix for auto-fix)
pnpm format         # Prettier (format:check to verify)
pnpm test           # Vitest (test:watch, test:coverage)
pnpm db:generate    # diff schema → new migration
pnpm db:migrate     # apply migrations to local D1
pnpm db:reset       # wipe local D1 (then db:migrate)
pnpm preview        # build + run in Workers runtime
```

Husky pre-commit runs lint + format on staged `.ts`/`.tsx`.

## Environment

All env vars flow through the typed lazy singleton at `src/lib/env.ts`. **Never use `process.env` directly** — in Cloudflare Workers, secrets only exist per-request, so `env` must be read lazily. `.env.local` is copied from `.env.local.example`.

| Var | Required | Notes |
|-----|----------|-------|
| `NEXTAUTH_SECRET` | Prod + dev | ≥32 chars, not a known placeholder; `openssl rand -base64 32` |
| `YOUTUBE_API_KEY` | Yes | All generation |
| `ANTHROPIC_API_KEY` | Yes | Tagging, Vibe Profiler, session naming |
| `GOOGLE_CLIENT_ID` / `_SECRET` | Prod | Dev uses a Credentials provider |
| `ANTHROPIC_TAGGING_MODEL` / `_VIBE_MODEL` / `_NAMING_MODEL` | Optional | Per-use-case model overrides |
| `STEAM_API_KEY` | Optional | Steam library sync |
| `IGDB_CLIENT_ID` / `_SECRET` + `TURNSTILE_*` | Optional | Together gate the catalog "Request a game" form |
| `DISCOGS_TOKEN` | Optional | Higher-rate tracklist loading |

Backstage (`/backstage/*`) is open in dev. In production it's gated by Cloudflare Access.

## Architecture

### Auth model

- **Two user modes:** guest (unauthenticated, localStorage) and logged-in (Google OAuth). No tier column — guestness is purely session-based.
- **Route allowlist:** every accessible route (page or API) must be registered in `src/lib/route-config.ts` with an `AuthLevel` (`Public` / `Optional` / `Required` / `Admin`). Unregistered routes 404 via middleware. One entry per `METHOD /path`, no wildcards — the only exception is NextAuth's `/api/auth/*` catch-all.
- **Enforcement layers:**
  - `src/middleware.ts` — allowlist 404 + CF Access cookie check for Admin in prod (signature verified by CF Access edge before reaching the Worker; the in-Worker check is structural only — see `cloudflare-access.ts`).
  - `withRequiredAuth` / `withOptionalAuth` / `withAdminAuth` wrappers — handler-layer enforcement (middleware can't call NextAuth's `auth()`).
  - Mutation routes on user-owned resources (sessions, playlist tracks) do an ownership check and return 403 on mismatch.
- **Input validation:** every POST/PATCH/DELETE body goes through a Zod schema in `src/lib/validation.ts`; errors return 400 via `zodErrorResponse` with a generic message (never leaks schema/field paths).
- **Rate limiting:** KV-backed sliding window for guest IPs (`src/lib/rate-limit.ts`); DB-backed atomic lock for authenticated generation (`Users.tryAcquireGenerationLock` — single UPDATE...RETURNING).

Adding a new API route: (1) register in `route-config.ts`, (2) wrap with the right auth wrapper, (3) add a Zod schema if it accepts a body, (4) ownership-check if it operates on user-specific resources.

### Guest vs authenticated

| Feature | Guest | Logged-in |
|---------|-------|-----------|
| Browse catalog | Yes | Yes |
| Generate playlist | Director only, no persistence | Full pipeline (Vibe Profiler + Director), persisted |
| Game library | `localStorage` (`bgm_guest_library`) | DB (`library_games`) |
| Session history | No | DB, FIFO-capped to 3 per user |
| Reroll / YT sync | No | Yes |
| Request a game | Yes (Turnstile) | Yes (Turnstile) |

Guest sessions use the `GUEST_SESSION_ID` constant (`"guest"`). Never hardcode the string.

### Pages

- `/` — `src/app/(main)/page.tsx` + `FeedClient.tsx`. Two modes driven by derived state:
  - **Launchpad** — onboarding screen when no tracks and not generating. Empty-library state shows shuffled covers from a small narrow projection (`Games.listPublishedCoverUrls`). Ready-library state has Curate CTA + size presets + `Advanced` toggle.
  - **Playlist** — three-region layout (sidebar / scrolling playlist / 80px PlayerPanel). Mobile stacks vertically with a separate header.
  - Transition is a single opacity cross-fade owned by FeedClient (timing constants at top of file).
- `/catalog` — browse published games, add to library with curation modes, right-side library drawer + PlayerPanel.
- `/backstage/{games,tracks,theatre,requests}` — admin control plane. Own `BackstageLayout`; **not** wrapped by `PlayerProvider`.

Each page owns its header/footer (no shared Header). Shared bits live in `src/components/layout/`.

### Client state: `PlayerProvider`

Composes hooks, owns the YouTube IFrame singleton, exposes everything via `usePlayerContext()`. Rendered in `src/app/(main)/layout.tsx`.

- `usePlaylist` — tracks + session management, fetches `/api/playlist`.
- `usePlayerState` — playback runtime (current track, shuffle, play/pause, revealed tracks for anti-spoiler). `reset()` clears runtime + cache; `resetPlayback()` only clears runtime (used post-generation to preserve guest cache).
- `useConfig` — app config in localStorage (track count, anti-spoiler, long/short toggles, playlist mode).
- `useGameLibrary(isSignedIn)` — DB for authed, localStorage for guests; same API both paths.
- `useYouTubePlayer` — module-level singleton with DOM element created off-screen **outside** the React tree so it survives App Router transitions.
- `media: MediaState | null` — unified playback interface; components read through this, never the YT player directly.
- `useSteamLibrary(isSignedIn)` — authenticated-only, used by catalog page; not composed into the provider.

**Persistence:** `bgm_playback_state` (position/track) + `bgm_playback_tracks` (playlist) + `bgm_revealed_tracks` — read via a unified `restoreData` memo on mount. Authed users clear guest artifacts and validate session ownership before hydrating; guests always restore tracks and verify video-ID match before restoring position. Position polls every ~5s. Pause state is persisted immediately (avoids stale closures).

**Known limitation:** YouTube IFrame auto-plays on restore — `startPaused` isn't reliably honored. Accepted as-is.

### Generation pipeline (`src/lib/pipeline/`)

Two entry points in `index.ts`:
- `generatePlaylist(send, userId, config)` — full pipeline + DB persistence.
- `generatePlaylistForGuest(send, gameSelections, config)` — Director only.

Both invoked from `POST /api/playlist/generate` wrapped in SSE via `makeSSEStream`. All candidate data is pre-cached during backstage onboarding (no YT or LLM calls at generation time for candidate loading).

Three phases:

1. **Candidates** (`candidates.ts`): `getTaggedPool()` reads active + tagged tracks with resolved videos.
2. **Rubric:** Journey mode hits `vibe-profiler.ts` LLM. Checks `findCachedRubric` (keyed on sorted game IDs) first; cache hit skips the call and doesn't consume the daily cap. Cache miss checks `USER_DAILY_LLM_CAP = 10`; if exceeded, falls back to `JOURNEY_ARC_TEMPLATE` with no rubric. Energy modes (`low`/`mid`/`high`) skip this entirely and use a static single-phase template from `director/arc-templates/`.
3. **Assembly + session naming:** TypeScript `assemblePlaylist` in `director/index.ts` — fully deterministic, no LLM. Produces `TrackDecision` records in `playlist_track_decisions` (the Theatre view's data). Energy modes pass `allowLastResort: false` so unmatched slots compact out. Concurrently, `generateSessionName()` runs a short LLM call (authed only, **not** gated by the daily cap) — runs on every generation including cached-rubric reruns. On failure, falls back to `"Game A, Game B, Game C"`.

**Reroll:** picks a random replacement from `getTaggedPool`, excluding in-session videos. For energy-mode playlists, the handler reads `playlist_mode` and applies the same energy filter as the original generation — no cross-mode bleed.

### The two "modes" (don't conflate them)

Both are enums in `src/types/index.ts`. Values are stable (stored in DB, sent on wire); display labels can change.

- **`CurationMode`** — *per game*, stored on `library_games.curation`. Controls how one game contributes to any playlist regardless of assembly mode.
  - `lite` — half budget weight
  - `include` — standard (default)
  - `focus` — guaranteed doubled budget, pre-assigned slots across the arc
- **`PlaylistMode`** — *per playlist*, stored on `playlists.playlist_mode`. Controls arc template + Vibe Profiler branching.
  - `journey` (default) — six-phase narrative arc, Vibe Profiler runs
  - `low` → Chill (energy 1+2), `mid` → Mix (all energies), `high` → Rush (energy 2+3) — static templates, no profiler

### Director (`src/lib/pipeline/generation/director/`)

```
index.ts              # assemblePlaylist, scoreTrack, expandArc
constants.ts          # scoring weights, budget weights, view-bias params
types.ts              # ArcSlot, ArcTemplate, ArcTemplatePhase
arc-templates/
  ├── journey.ts      # six-phase
  ├── chill.ts        # single Steady phase, energies 1+2
  ├── mix.ts          # single Steady phase, all energies
  └── rush.ts         # single Steady phase, energies 2+3
```

`assemblePlaylist(taggedPools, games, targetCount, rubric, arcTemplate, options?)` is the only entry. View-bias scoring is always on. Adding a mode = new arc template file + case in `getEnergyModeTemplate`.

### Game onboarding (backstage-driven)

Three phases (`src/lib/pipeline/onboarding/`):

1. **Load tracks** from `TracklistSource` (Discogs release/master, VGMdb, manual).
2. **Resolve videos** (`youtube-resolve.ts`) — LLM playlist matching + fallback search, cached in `video_tracks`. Capped at `RESOLVE_POOL_MAX` (80) per batch, `RESOLVE_FALLBACK_MAX` (10) for search fallback.
3. **Tag tracks** — LLM produces energy/roles/moods/instrumentation into `tracks`.

A game is only Director-ready after all three. `reingest` re-runs all three; `retag` re-runs only phase 3. `resolve-selected` / `tag-selected` operate on user-picked subsets.

### Database

Drizzle ORM on D1 everywhere — dev, staging, production. Local dev uses miniflare D1 emulation (via `initOpenNextCloudflareForDev()` in `next.config.ts`). Tests use `better-sqlite3` wrapped in a D1-compat layer (`createTestDrizzleDB` in `src/lib/db/test-helpers.ts`).

```
src/lib/db/
├── index.ts            # getDB() via getCloudflareContext; batch() with parallel chunking over D1's 100-query limit
├── drizzle-schema.ts   # schema / indexes / FKs
├── repo.ts             # barrel for repos/
├── repos/              # one file per domain
├── mappers.ts          # row → typed object
├── queries.ts          # shared Drizzle helpers
└── test-helpers.ts
```

Users are created via `Users.createFromOAuth()` on first Google sign-in; dev's Credentials provider creates them on the fly.

### Review flags

`ReviewFlags.markAsNeedsReview(gameId, reason, detail?)` sets `games.needs_review = 1` and inserts into `game_review_flags`. Pipeline flags raise when the generation encounters bad data (no usable tracks, playlist missing). Backstage surfaces them; operators clear them via `DELETE /api/backstage/review-flags`.

### LLM providers (`src/lib/llm/`)

All use Anthropic. All implement `LLMProvider.complete(system, user, opts)`.

- `getTaggingProvider()` — onboarding video resolver + tagger. Override with `ANTHROPIC_TAGGING_MODEL`.
- `getVibeProfilerProvider()` — Journey-mode only. Override with `ANTHROPIC_VIBE_MODEL`.
- `getSessionNamingProvider()` — always on (authed), not gated by daily cap. Prompt includes `PlaylistMode` so names diverge across modes. Override with `ANTHROPIC_NAMING_MODEL`.

### Config

Stored in `localStorage`, not DB. No `/api/config` route. Keys in `src/hooks/config/useConfig.ts`:

| Key | Default |
|-----|---------|
| `bgm_target_track_count` | 50 |
| `bgm_anti_spoiler_enabled` | `"0"` |
| `bgm_allow_long_tracks` | `"0"` |
| `bgm_allow_short_tracks` | `"1"` (always forced false in practice) |
| `bgm_playlist_mode` | `"journey"` |

Shared across all users of a browser (independent of identity).

### External services

- **Steam sync** (`src/lib/services/external/steam-sync.ts`) — authed-only *discovery aid*, not auto-import. Links Steam ID, pulls public library top-N by playtime (`STEAM_SYNC_MAX_GAMES = 500`), matches against catalog via JOIN on `games.steam_appid`. Cooldown (`STEAM_SYNC_COOLDOWN_MS = 1h`) is enforced in SQL via `users.steam_synced_at` because that column is also the "Last synced X ago" UI display. 429 responses carry a structured `cooldownMinutes: number` field — **never parse server error strings on the client** for data; see `useSteamLibrary` for the right pattern.
- **Game requests** (`src/lib/services/external/igdb.ts`) — catalog empty-state search hits IGDB via Twitch OAuth (module-level token cache, ~60d lifetime). `searchGames` filters client-side (IGDB's `where` + `search` combo is unreliable): drops `version_parent`, `parent_game`, category blacklist, name dedupe, slice 10. Errors return `[]` (soft feature). `GameRequests.upsertRequest` is atomic via `INSERT ... ON CONFLICT DO UPDATE WHERE acknowledged = 0`.
- **IGDB/Turnstile feature flag** — `requestFormEnabled` is computed server-side from `env.igdbClientId && env.igdbClientSecret && env.turnstileSiteKey`. When off, empty state degrades to "No games found" with no input. The `/api/games/search-igdb` route returns 404 when creds are missing so the client can degrade at runtime too.
- **Cover URLs** — `gameRequestSchema.coverUrl` rejects any host other than `images.igdb.com` (DB stores only IGDB origins).

### CSP

`next.config.ts` allows:
- `script-src` / `connect-src` / `frame-src`: `https://challenges.cloudflare.com` (Turnstile)
- `img-src`: `https://images.igdb.com` (IGDB covers)

## Code style

Follow what the codebase already does. Highlights that come up often:

- **Enums, not literal unions.** `CurationMode`, `PlaylistMode`, `TrackMood`, `TrackInstrumentation`.
- **`@/*` imports only**, never relative `../../`.
- **`import type`** for type-only imports.
- **Prettier:** 100-char width, 2-space tab, semicolons, double quotes, trailing commas.
- **No `process.env`** — always `@/lib/env`.
- **No `console.log`** (lint-banned). `console.warn` / `console.error` on the server are fine.
- **No non-null assertions** (`!`) outside DB repos and tests.
- **Comments:** explain *why*, not *what*. Public functions get docstrings; internals only when the algorithm is non-obvious.
- **Errors:** subclass `Error` with an explicit `this.name`. Route handlers wrap in `NextResponse.json({ error }, { status })` with generic messages. SSE streams emit `SSEEventType.Error` rather than throwing.
- **`useEffect` placement:** define all referenced `const`s *before* the effect (temporal-dead-zone quirk of the hook composition patterns here).

## Schema changes

```
1. Edit src/lib/db/drizzle-schema.ts
2. pnpm db:generate     # creates a new .sql migration
3. pnpm db:migrate      # apply to local D1
4. wrangler d1 migrations apply bgmancer-prod --remote   # production
```

**Pre-prod shortcut:** while there are no real users, collapsing to a single migration is fine — delete `drizzle/migrations/` and re-run `db:generate`. Once production has data, use incremental migrations only.

## Deployment

Cloudflare Workers via `@opennextjs/cloudflare`. Infrastructure in `wrangler.jsonc`.

```bash
# Production
pnpm cf-typegen
pnpm opennextjs-cloudflare build
wrangler deploy
wrangler d1 migrations apply bgmancer-prod --remote

# Staging
wrangler deploy --env staging
wrangler d1 migrations apply bgmancer-staging --remote --env staging

# Secrets
wrangler secret put <NAME>              # prod
wrangler secret put <NAME> --env staging

# Ops
wrangler rollback
wrangler tail
```

CF dashboard build command: `pnpm cf-typegen && pnpm opennextjs-cloudflare build`.

## Load-bearing invariants (don't break these)

- Every route registered in `src/lib/route-config.ts` — no wildcards beyond NextAuth.
- `env` singleton, never `process.env`.
- Next.js 16 with `@opennextjs/cloudflare` uses `middleware.ts` (not Next 16's `proxy.ts` — not yet supported by the adapter).
- `process.env.NODE_ENV` is unreliable in client components under Turbopack — use `env.isDev` server-side.
- `GUEST_SESSION_ID` constant, never the literal `"guest"`.
- Sessions FIFO-evict to `MAX_PLAYLIST_SESSIONS` (3) per user.
- `games.yt_playlist_id` caches discovered OST playlist IDs to conserve YT quota.
- Enum *values* are stable (DB + wire); display labels can change.

## Test philosophy

- 100% coverage target on `src/lib/**/*.ts` (enforced in `vitest.config.ts`).
- Tests adapt to production code, not the reverse.
- Don't mock the subject under test. Don't assert error messages word-for-word — use regex or structured codes.

## Skill routing

When a user request matches a skill, invoke it via the Skill tool **first** — the specialized workflows beat ad-hoc answers.

- Product ideas, "is this worth building" → **office-hours**
- Bugs, errors, 500s, "why is this broken" → **investigate**
- Ship, deploy, push, create PR → **ship**
- QA, test the site, find bugs → **qa**
- Code review, check my diff → **review**
- Post-ship docs → **document-release**
- Weekly retro → **retro**
- Design system, brand → **design-consultation**
- Visual audit, polish → **design-review**
- Architecture review → **plan-eng-review**
- Save progress, checkpoint, resume → **checkpoint**
- Code quality, health check → **health**
