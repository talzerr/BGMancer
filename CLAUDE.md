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
- `ANTHROPIC_NAMING_MODEL` — optional; override Anthropic model for the session-naming LLM call (defaults to `ANTHROPIC_MODEL`)
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — required in production for Google OAuth sign-in. In local dev, a Credentials provider is used instead
- `IGDB_CLIENT_ID` / `IGDB_CLIENT_SECRET` — optional; powers the catalog "Request a game" empty state. Twitch dev console credentials. When unset (or `TURNSTILE_SITE_KEY` is unset), the request form is hidden server-side and the empty state shows only "No games found"
- `TURNSTILE_SITE_KEY` / `TURNSTILE_SECRET_KEY` — Cloudflare Turnstile credentials. Used for guest playlist generation and game requests. In dev (`env.isDev`) or when the secret is unset, server-side verification is short-circuited
- Backstage (`/backstage/*`) is open in local dev. In production, it's gated by Cloudflare Access on `bgmancer.com/backstage*`

Schema is managed by Drizzle ORM with migrations stored in `drizzle/migrations/`. Locally, apply with `pnpm db:migrate`. In production, apply with `wrangler d1 migrations apply bgmancer-prod --remote`.

## Architecture

This section describes the current codebase. For prescriptive rules and patterns, `docs/claude/ARCHITECTURE.md` and `docs/claude/DESIGN_SYSTEM.md` are authoritative and take precedence over descriptions here.

### Authentication & Security

**Auth system:** NextAuth v5 (beta) as the sole auth provider. In dev, a Credentials provider allows sign-in with any name. In production, Google OAuth.

**User model:** Two modes — Guest (unauthenticated) and Logged-in (Google OAuth). No tier column; the distinction is purely session-based. Users are created in the DB on first OAuth sign-in via `Users.createFromOAuth()`.

**Route auth config (`src/lib/route-config.ts`):** Single source of truth — every accessible route (pages and API) must be registered here. Unregistered routes return 404. Each entry declares its auth level: `Public`, `Optional`, `Required`, or `Admin`.

**Middleware (`src/middleware.ts`):** Runs on all non-static requests. Reads the route config and enforces: (1) allowlist — unregistered routes get 404, (2) admin routes — in production, requires `CF_Authorization` cookie (set by Cloudflare Access) as defense in depth. Uses the deprecated `middleware.ts` convention (not Next.js 16's `proxy.ts`) for `@opennextjs/cloudflare` compatibility.

**Route wrappers (`src/lib/services/auth/route-wrappers.ts`):** `withRequiredAuth(handler, label)` and `withOptionalAuth(handler, label)` enforce user auth at the handler level. Middleware can't call `auth()` (NextAuth doesn't work in the middleware layer), so user auth is enforced here.

**Auth helpers (`src/lib/services/auth/auth-helpers.ts`):** `getAuthSession()`, `getAuthUserId()`, `AuthRequiredError`. Used by route wrappers and custom handlers (generate, sync).

**Ownership checks:** Mutation routes for sessions and playlist tracks verify the resource belongs to the requesting user (403 on mismatch).

**Input validation:** All POST/PATCH/DELETE routes validate bodies with Zod schemas defined in `src/lib/validation.ts`.

**Rate limiting:** Guest generation is IP-rate-limited via `src/lib/rate-limit.ts` (KV-backed sliding window in production, in-memory in dev). Authenticated users have a DB-backed generation cooldown lock.

**Guest vs Logged-in behavior:**

| Feature                  | Guest                         | Logged-in                                           |
| ------------------------ | ----------------------------- | --------------------------------------------------- |
| Browse catalog           | Yes                           | Yes                                                 |
| Generate playlist        | Director-only, no persistence | Full pipeline (Vibe Profiler + Director), persisted |
| Game library             | localStorage-backed           | DB-backed                                           |
| Session history          | No                            | DB-backed                                           |
| Reroll / Sync to YouTube | No                            | Yes                                                 |
| Request a game (catalog) | Yes (Turnstile-gated)         | Yes (Turnstile-gated)                               |

When adding a new API route:

1. Add it to `src/lib/route-config.ts` with the correct `AuthLevel`. Register routes **explicitly** — one entry per `METHOD /path`. Do not introduce new wildcards; they obscure what's exposed and make the allowlist less useful as a security review surface. Dynamic segments like `[gameId]` are fine (and required).
2. Use `withRequiredAuth` or `withOptionalAuth` wrapper
3. Add a Zod schema in `src/lib/validation.ts` if it accepts a body
4. Add ownership checks if it operates on user-specific resources

### Pages and routing

Next.js App Router with three main page areas:

- `/` — main feed (`src/app/(main)/page.tsx` + `src/app/(main)/FeedClient.tsx`). Renders one of two layouts based on derived `mode` state in `FeedClient`:
  - **Launchpad mode** (`src/components/launchpad/Launchpad.tsx`) — full-width centered onboarding screen shown when there are no tracks, no in-flight generation, and the user has not pressed Curate. Two states: empty library (faint game cover preview row from published catalog, app icon, tagline + subtitle, CTA → catalog) and ready library (cover row + Curate + size presets + `Advanced` reveal with custom size and Long/Short tracks). The empty state receives `previewCovers` from the server component (`page.tsx` fetches and shuffles published game thumbnails).
  - **Playlist mode** — three-region full-height flexbox layout. Left sidebar (290px, desktop-only: logo, LibraryWidget, GenerateSection, session history, user/auth, footer links). Center (scrollable playlist with sticky header). Right sidebar (80px PlayerPanel, desktop-only). On mobile the layout stacks vertically with a separate header.
  - The transition between modes is a single opacity cross-fade owned by `FeedClient` (timing constants `LAUNCHPAD_FADE_MS`, `LAUNCHPAD_SWAP_DELAY_MS` at the top of the file). Generation runs in the background after the layout swap.
- `/catalog` — catalog browser + library drawer (`src/app/(main)/catalog/page.tsx` + `src/app/(main)/catalog/CatalogClient.tsx`) — browse published games, add to library with curation modes. Full-height flexbox: center (header + scrollable grid), library drawer (right), and PlayerPanel (right, conditional on active playlist).
- `/backstage` — admin control plane (`src/app/(backstage)/backstage/`) — inspect/correct track metadata, review flags, Director telemetry, and the game request queue. Four views:
  - `/backstage/games` — game list with needs-review badges, re-ingest / retag actions
  - `/backstage/tracks` — track lab: full tag table with inline editing via `TrackEditSheet`, bulk actions, re-tag trigger
  - `/backstage/theatre` — Director telemetry: per-session score breakdown and arc-phase audit trail
  - `/backstage/requests` — IGDB-backed game request queue. Defaults to unacknowledged rows ordered by `request_count` desc; toggle "Show all" to include acknowledged. Acknowledge button is per-row

All non-backstage pages are wrapped by `PlayerProvider` (in `src/app/layout.tsx`), which manages global state via `src/context/player-context.tsx`. Backstage has its own layout (`BackstageLayout`) and does not use `PlayerProvider`.

**Page-owned layouts:** Each page owns its full layout including header, navigation, and footer. There is no shared `Header` component — FeedClient and CatalogClient each render their own header inline. Shared layout pieces live in `src/components/layout/`:

- `LogoLink` — logo + wordmark link to home, used by both pages
- `FooterLinks` — Source/Legal/Discord links, used in the feed sidebar and the catalog library drawer

**Sign-out cleanup:** `performSignOut()` (exported from `src/components/AuthButtons.tsx`) centralizes the sign-out flow: clears playback state, clears guest library, then calls `signOut()`. All sign-out call sites use this function.

**Sign-in prompt:** `AuthButtons` renders a `LoginPrompt` popover for guest users (dismissible, persisted via localStorage). The `hidePrompt` prop suppresses it — used on the launchpad to avoid showing the prompt before the user has experienced any value. The timing/trigger for sign-in nudges elsewhere is a PM decision.

**Player UI:** The `PlayerPanel` (`src/components/player/PlayerPanel.tsx`) is a compact 80px vertical sidebar shown on desktop. Elements are clustered into two zones: a top block (cover art as clickable YouTube link, track name + game name text, progress bar, transport controls) and a bottom-anchored volume slider, with a single flex spacer between them. It reads all state from `usePlayerContext().media`. On mobile, the PlayerPanel is hidden (`hidden lg:flex`).

### Global state (PlayerContext)

`PlayerProvider` (rendered in `src/app/(main)/layout.tsx`) composes four hooks, manages the YouTube player, and shares their state app-wide. It receives `isSignedIn` from the server layout (via `auth()`) and exposes it on the context:

- `usePlaylist` — playlist tracks + session management, fetches from `/api/playlist`
- `usePlayerState` — playback state (current track, shuffle, play/pause, revealed tracks for anti-spoiler). Two reset functions: `reset()` clears runtime state AND localStorage cache; `resetPlayback()` clears runtime state only (used after generation to preserve guest cache).
- `useConfig` — app config (track count, anti-spoiler, etc.) stored in localStorage
- `useGameLibrary(isSignedIn)` — game library; authenticated users fetch from `/api/games`, guests use localStorage (key `bgm_guest_library`) hydrated against `/api/games/catalog`
- `useYouTubePlayer` — YouTube IFrame API wrapper, managed by the context (not by any component). Exposes playback controls via the `MediaState` interface.
- `useSteamLibrary(isSignedIn)` — authenticated-only Steam library state (used by the catalog page, not composed into `PlayerProvider`). Owns `linked`, `steamSyncedAt`, `matchedGameIds`, `cooldownMinutes`, and the `sync`/`disconnect` mutations. Guest users never call it.
- `media: MediaState | null` — unified playback interface (`isPlaying`, `currentTime`, `duration`, `volume`, `togglePlayPause`, `seekTo`, `applyVolume`). Null when no track is active. Components consume media state through this interface, never through the YouTube player directly.
- `isSignedIn` — boolean, available on the context for auth-gating UI
- `toggleAntiSpoiler` — single callback that flips the anti-spoiler config and clears revealed tracks (preserving the currently playing one) when the toggle goes from off→on. This logic lives on the context because both `usePlayerState` (revealed tracks) and `useConfig` (the toggle) are involved.

Use `usePlayerContext()` to access any of these from any client component.

**Playback persistence:** On mount, `PlayerProvider` runs a unified restore memo (`restoreData`) that reads cached playback state from localStorage (`bgm_playback_state` for position/track, `bgm_playback_tracks` for the playlist, `bgm_revealed_tracks` for anti-spoiler state — see `src/hooks/player/playback-state.ts`). For signed-in users: clears guest artifacts, validates the cached session belongs to the current user, and hydrates if valid. For guests: always restores cached tracks, validates video ID match before restoring position. The server fetch then refreshes in the background. While playing, the player polls position every ~5s and writes to `bgm_playback_state`. Pause state is persisted immediately via `patchPausedState()` to avoid stale closure issues. The YouTube IFrame player itself is a module-level singleton (`useYouTubePlayer.ts`) — only one instance ever exists, with its DOM element created off-screen outside the React tree to survive App Router page transitions.

**Guest hydration:** `FeedClient` starts with `hydrated = false` for guests (server can't read localStorage), rendering at `opacity: 0` until a mount effect flips it to `true`. This prevents a flash of the launchpad when a guest has cached playlist data.

**Known limitation — pause state not restored:** Although `paused` is persisted to localStorage via `patchPausedState()`, the YouTube IFrame player always auto-plays on restore. The `startPaused` option is passed through but the YouTube API does not reliably honor it. Accepted as-is — on refresh, playback resumes from the saved position rather than staying paused.

### Database layer (`src/lib/db/`)

Uses **Drizzle ORM** with **Cloudflare D1** as the database driver everywhere (dev, staging, production). Local dev uses D1 emulation via miniflare (provided by `initOpenNextCloudflareForDev()` in `next.config.ts`). Tests use better-sqlite3 in-memory databases wrapped with a D1-compat layer.

- `index.ts` — `getDB()` returns a D1-backed Drizzle instance via `getCloudflareContext().env.DB`
- `drizzle-schema.ts` — Drizzle schema definition for all tables, indexes, and foreign keys
- `repo.ts` — barrel re-export for all repos in `repos/`
- `repos/` — one file per domain: `games`, `backstage-games`, `users`, `sessions`, `playlist`, `tracks`, `video-tracks`, `review-flags`, `decisions`, `user-steam-games`, `game-requests`
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
2. **Vibe Profiler** (`vibe-profiler.ts`): LLM produces a `VibeRubric` from the session's game titles + per-game tag distributions. The rubric provides per-phase mood/instrument overrides that sharpen the Director's arc template. Before calling the LLM, the pipeline checks the user's existing sessions for a cached rubric matching the same game set (`findCachedRubric`); a cache hit reuses the rubric without an LLM call and does not consume the daily LLM cap. On cache miss, the daily cap (`USER_DAILY_LLM_CAP = 10` actual LLM calls) is checked silently — if exceeded, the Director falls back to the default arc template with no user-visible indication. The profiler produces only the rubric — session naming is a separate LLM call (step 3). Always skipped for guests.
3. **Deterministic arc assembly + parallel session naming** (`director.ts` + `session-naming.ts`): the TypeScript Director builds the final ordered playlist from the tagged pool, shaping energy flow and cross-game balance. **No LLM involvement in the Director.** Each selected track produces a `TrackDecision` record (score components, arc phase, pool size, game budget) persisted via `DirectorDecisions.bulkInsert()` into `playlist_track_decisions` — this is the Director telemetry shown in the Theatre view. The `arc_phase` field is also exposed to the client via a left-join in the playlist query, used for subtle spacing between arc phase transitions in the playlist UI (no labels or phase names are shown). Concurrently with the Director, `generateSessionName()` fires a dedicated, short LLM call (authenticated path only, guests skipped) that reads game titles + curation modes and returns a fresh 2–5 word playlist title. The naming call runs on **every** authenticated generation — cached-rubric reruns still get a new name — and is **not** gated by `USER_DAILY_LLM_CAP`. Any failure resolves to `null` and `persistSession` falls back to the deterministic `"Game A, Game B, Game C"` concatenation.

**Track reroll** (`POST /api/playlist/[id]/reroll`): picks a random replacement from the same backstage-curated pool (`getTaggedPool`), excluding tracks already in the current session. No YouTube API calls — everything from DB.

Curation modes (see `CurationMode` enum in `src/types/index.ts`):

- `lite` — half budget weight in phase 3
- `include` — standard (default)
- `focus` — guaranteed double-weighted budget in phase 3

**Game onboarding** (`onboarding.ts`): backstage-driven process that prepares a game for playlist generation. Three phases:

1. **Load tracks** — fetch tracklist from a source (`TracklistSource` enum: `DiscogsRelease`, `DiscogsMaster`, `Vgmdb`, `Manual`). Source metadata and URL generation live in `src/lib/services/parsing/tracklist-source.ts`.
2. **Resolve videos** (`youtube-resolve.ts`) — align track names to YouTube video IDs via LLM playlist matching + fallback search; results cached in `video_tracks` table. Resolution is capped at `RESOLVE_POOL_MAX` (80) tracks per batch and `RESOLVE_FALLBACK_MAX` (10) for YouTube search fallback.
3. **Tag tracks** — LLM produces energy, roles, moods, instrumentation for each resolved track; stored in `tracks` table. Tags can be cleared selectively via `Tracks.clearTags(gameId, names?)`.

Only after all three phases complete is a game ready for the Director. The Backstage reingest action re-runs all phases; retag re-runs only phase 3. Selective resolve/tag operations are available via `POST /api/backstage/resolve-selected` and `POST /api/backstage/tag-selected`, which operate on a subset of tracks chosen in the game detail view's multi-selection UI.

### LLM providers (`src/lib/llm/`)

`src/lib/llm/index.ts` exports:

- `getTaggingProvider()` — video resolver + track tagger (used during backstage onboarding). Override model with `ANTHROPIC_TAGGING_MODEL`.
- `getVibeProfilerProvider()` — Vibe Profiler (used during playlist generation). Override model with `ANTHROPIC_VIBE_MODEL`.
- `getSessionNamingProvider()` — session naming LLM call (used during authenticated playlist generation, runs in parallel with the Director; not gated by `USER_DAILY_LLM_CAP`). Override model with `ANTHROPIC_NAMING_MODEL`.

All providers implement `LLMProvider` (`src/lib/llm/provider.ts`): `complete(system, user, opts)`. All LLM calls use Anthropic (`ANTHROPIC_API_KEY` required).

### Config system

Config is stored in **localStorage** (not the DB). `useConfig` (`src/hooks/useConfig.ts`) reads/writes via `localStorage` with the following keys:

| Key                        | Type       | Default | Purpose                                            |
| -------------------------- | ---------- | ------- | -------------------------------------------------- |
| `bgm_target_track_count`   | number     | 50      | Target playlist length                             |
| `bgm_anti_spoiler_enabled` | "1" \| "0" | "0"     | Blur unplayed track titles                         |
| `bgm_allow_long_tracks`    | "1" \| "0" | "0"     | Allow tracks >9min                                 |
| `bgm_allow_short_tracks`   | "1" \| "0" | "1"     | Allow tracks <90s (note: always false in practice) |

There is no `/api/config` route. The hook uses `localStorage.getItem()` / `localStorage.setItem()` directly with boolean parsing via `v === "1"`. To add a new config key:

1. Add an `lsGet`/`lsSet` call in `useConfig.ts`
2. Update state and return from the hook
3. Expose getter/setter for the new key in the hook's return object

Config persists across sessions and is independent of user identity (all users share the same browser localStorage).

### Guest library (`src/lib/guest-library.ts`)

Guests get a localStorage-backed game library that mirrors the authenticated DB-backed library. The `useGameLibrary` hook accepts `isSignedIn` and branches internally:

- **Authenticated:** all operations go through `/api/games` (GET/POST/PATCH/DELETE)
- **Guest:** reads/writes `bgm_guest_library` in localStorage as `{ gameId, curation }[]`, hydrates into full `Game` objects via `/api/games/catalog`

The hook exposes `addGame(game, curation)`, `updateCuration(gameId, curation)`, and `deleteGame(gameId)` which work identically for both paths. Guest generation sends `gameSelections` in the POST body to `/api/playlist/generate`, which the backend already supports via `generatePlaylistForGuest`. Guests never run the Vibe Profiler (Director uses the default arc template).

### Steam library sync (`src/lib/services/external/steam-sync.ts`)

Authenticated-only discovery feature: users link a Steam profile, the backend fetches their public library via Steam Web API, and matched catalog games become a client-side filter on the catalog page. This is a **discovery aid, not auto-import** — games still need to be added to the user's BGMancer library manually.

**Data model:**

- `users.steam_id` (text, nullable) — 64-bit Steam ID, stored as text
- `users.steam_synced_at` (text, nullable) — ISO timestamp of last successful sync. Used both to enforce the 1-hour cooldown AND to power the "Last synced X ago" display; single source of truth for both.
- `user_steam_games` join table — `(user_id, steam_app_id, playtime_minutes)`, unique per `(user_id, steam_app_id)`. No `game_id` column; catalog matching is a JOIN at read time on `games.steam_appid`.

**Service** (`src/lib/services/external/steam-sync.ts`) owns all Steam Web API calls (`ISteamUser/ResolveVanityURL`, `IPlayerService/GetOwnedGames`), the cooldown check, the top-N cap, and the atomic batch persistence. Route handlers are thin wrappers that map typed errors (`SteamApiError`, `PrivateProfileError`, `InvalidSteamUrlError`, `VanityNotFoundError`, `CooldownError`, `MissingSteamUrlError`) to masked HTTP responses. Constants in `src/lib/constants.ts`: `STEAM_SYNC_COOLDOWN_MS` (1 hour), `STEAM_SYNC_MAX_GAMES` (500, sorted by playtime).

**Cooldown**: enforced in SQL, not KV — because `steam_synced_at` is load-bearing UI state (popover display), not an ephemeral rate limit. The KV rate limiter (`src/lib/rate-limit.ts`) is reserved for IP-keyed, count-in-window throttling (guest generation); Steam sync is a user-keyed, once-per-hour action whose "when" is a user-facing fact.

**Error masking**: the sync route's 429 response includes structured `cooldownMinutes: number` alongside the human-readable `error` string. The client hook consumes the structured field directly — **never parse server error strings on the client** for data. See `useSteamLibrary` as the reference pattern for how hooks own domain logic and expose structured state to UI components.

**Backstage Steam routes** (`/api/backstage/steam/*`) are a separate, admin-only surface used during game onboarding to look up Steam game metadata (store search, owned-games lookup for testing). They share `parseSteamInput`/`resolveVanityUrl`/`fetchOwnedGames` helpers via the same service module.

### Game requests (`src/lib/services/external/igdb.ts`)

The catalog empty state lets any user (guest or logged-in) request a game that isn't in the catalog yet. The flow is:

1. User searches the catalog → zero results → `GameRequestPrompt` is rendered (`src/components/library/GameRequestPrompt.tsx`). All client-side state, the debounced IGDB fetch, and the submit POST live in `useGameRequest` (`src/hooks/library/useGameRequest.ts`).
2. The current catalog search term is shown as preview text inside an inactive input. On first focus the input activates, copies the term into the hook's editable `query`, and the 300ms-debounced effect calls `GET /api/games/search-igdb`.
3. The user clicks a result. The component awaits a Turnstile token via `useTurnstileToken` (`src/hooks/shared/useTurnstileToken.ts`), then calls the hook's `submitRequest`. The shared Turnstile hook is also used by `FeedClient` for guest playlist generation — single source of truth for the script-load race + render dance.
4. The server rate-limits per IP (5/hr), verifies Turnstile, then calls `GameRequests.upsertRequest` — new rows insert with `request_count = 1`, existing unacknowledged rows increment, acknowledged rows are no-ops. Always returns `{ success: true }`.

**Data model:** single `game_requests` table keyed on `igdb_id` (the natural identity from IGDB; no synthetic PK). Columns: `name`, `cover_url`, `request_count`, `acknowledged`, `created_at`, `updated_at`.

**IGDB service** (`src/lib/services/external/igdb.ts`) handles Twitch OAuth client-credentials with a module-level token cache (per Worker isolate; tokens last ~60 days). `searchGames(query)` POSTs to `/v4/games` and filters client-side because IGDB doesn't reliably combine `search` with `where` clauses. Filter pipeline (in order): `version_parent` (excludes platform re-releases), `parent_game` (excludes DLC/expansions/content packs), then a `category` blacklist as a backstop. Finally a name dedupe (lowercased, first wins) and slice to 10. All errors return `[]` — this is a soft feature.

**Server-side feature flag:** `requestFormEnabled` is computed in `src/app/(main)/catalog/page.tsx` as `Boolean(env.igdbClientId && env.igdbClientSecret && env.turnstileSiteKey)` and passed down. When false, the empty state renders only the icon and "No games found" — no input. The client also reacts to a 404 from `/api/games/search-igdb` by switching into the same degraded state at runtime.

**Backstage queue** (`/backstage/requests`): admin view of unacknowledged requests sorted by `request_count` desc. The "Show all" toggle adds acknowledged rows. The query param contract is strict: `?all=1` includes acknowledged, anything else returns the unacknowledged-only view.

**CSP requirements:** `next.config.ts` allows `https://challenges.cloudflare.com` in `script-src`, `connect-src`, and `frame-src` for Turnstile, plus `https://images.igdb.com` in `img-src` for cover thumbnails. Both `FeedClient` (guest playlist generation) and `GameRequestPrompt` rely on this.

### API routes

All under `src/app/api/`. Auth levels are defined in `src/lib/route-config.ts`. Key routes:

- `POST /api/playlist/generate` — SSE stream; runs the pipeline (Optional — guests get Director-only)
- `GET /api/games` — user's game library (Optional — guests get `[]`)
- `POST/PATCH/DELETE /api/games` — game library mutations (Required)
- `GET /api/games/catalog` — published game catalog (Public)
- `GET /api/games/search-igdb?q=...` — proxy search against IGDB for the catalog "Request a game" empty state (Public). Returns 404 when IGDB credentials aren't configured (the client uses this to hide the request form). IP-rate-limited 30/min via `igdb-search:${ip}`
- `POST /api/games/request` — register a game request (Public). Body: `{ igdbId, name, coverUrl, turnstileToken }`. Verified server-side via Turnstile (rejects with 403 on failure), then IP-rate-limited 5/hr via `game-request:${ip}`. Always returns `{ success: true }` regardless of internal state (new row, increment, or no-op on already-acknowledged) — the client never learns whether the request was new
- `GET /api/playlist` — fetch tracks (Optional — guests get `[]`). Response includes `arc_phase` per track via a left-join on `playlist_track_decisions`; null for guest playlists or tracks without decision data
- `DELETE /api/playlist` — clear playlist (Required)
- `PATCH /api/playlist` — reorder tracks (Optional — guests get silent 200)
- `DELETE /api/playlist/[id]` — remove a track (Required + ownership)
- `POST /api/playlist/[id]/reroll` — reroll a single track (Required + ownership)
- `GET /api/sessions` — session list (Optional — guests get `[]`)
- `PATCH/DELETE /api/sessions/[id]` — session management (Required + ownership)
- `POST /api/sync` — sync playlist to YouTube account (Required + OAuth access token)
- `POST /api/steam/sync` — link and/or re-sync the user's Steam library (Required). Body: `{ steamUrl? }`. Returns `{ totalSynced, catalogMatches, steamSyncedAt }`. On 429 cooldown the body also carries `cooldownMinutes: number`.
- `GET /api/steam/library` — returns `{ linked: false }` or `{ linked: true, steamSyncedAt, matchedGameIds: string[] }` (Required)
- `DELETE /api/steam/link` — unlink Steam account; atomically nulls `users.steam_id`/`steam_synced_at` and drops all `user_steam_games` rows for the user (Required)

Backstage API routes (all under `src/app/api/backstage/`, auth level: Admin). Every route is explicitly registered in `src/lib/route-config.ts` — no wildcards (NextAuth's `/api/auth/*` is the only remaining wildcard, for its catch-all):

- `GET /api/backstage/dashboard` — admin dashboard data
- `GET /api/backstage/games` — paginated game list with needs-review flag
- `POST /api/backstage/games` — create a new game
- `PATCH/DELETE /api/backstage/games/[gameId]` — update or delete a game
- `GET /api/backstage/games/[gameId]/tracks` — tracks for a single game
- `GET/POST/PATCH/DELETE /api/backstage/tracks` — full track table with tag metadata and bulk mutations
- `POST /api/backstage/tracks/review` — mark tracks as reviewed
- `POST /api/backstage/load-tracks` — fetch tracklist from the configured source (Discogs / VGMdb / manual); streams SSE progress
- `POST /api/backstage/import-tracks` — import tracks into the tracks table
- `POST /api/backstage/resolve` / `POST /api/backstage/resolve-selected` — align track names to YouTube video IDs; selected variant operates on a user-chosen subset; streams SSE progress
- `POST /api/backstage/retag` / `POST /api/backstage/tag-selected` — LLM re-tagging; selected variant advances phase to Tagged when all taggable tracks are done; streams SSE progress
- `POST /api/backstage/reingest` — clear tracks and re-run all onboarding phases; streams SSE progress
- `POST /api/backstage/quick-onboard` — end-to-end onboarding convenience
- `POST /api/backstage/publish` / `POST /api/backstage/bulk-publish` — mark games published
- `DELETE /api/backstage/review-flags` — clear per-game review flags
- `GET /api/backstage/steam/games` — fetch a Steam user's owned games (admin testing / game onboarding)
- `GET /api/backstage/steam/search` — search the Steam store by name (admin game onboarding)
- `GET /api/backstage/theatre/sessions` — session list for Theatre view
- `GET /api/backstage/theatre/[playlistId]` — full telemetry for one playlist (tracks + decisions + budgets + rubric)
- `GET /api/backstage/requests` — game request queue. Defaults to unacknowledged-only ordered by `request_count` desc. Pass `?all=1` to also include acknowledged rows; any other value (or absent) returns the unacknowledged view
- `POST /api/backstage/requests/acknowledge` — mark a request as acknowledged. Body: `{ igdbId }`. Idempotent — acknowledging an already-acknowledged or nonexistent row is a no-op

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
- **Guest sessions use `GUEST_SESSION_ID`** (`"guest"`, defined in `src/lib/constants.ts`) — never hardcode the string `"guest"` directly
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
