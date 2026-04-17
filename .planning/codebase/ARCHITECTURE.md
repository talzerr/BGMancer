# Architecture

**Analysis Date:** 2026-04-17

## Pattern Overview

**Overall:** Next.js 16 App Router with Cloudflare Workers backend, managed global state via React Context, three-phase playlist generation pipeline (candidate gathering → rubric resolution → deterministic assembly).

**Key Characteristics:**

- Server-side route validation via allowlist (`src/lib/route-config.ts`)
- Client-side global state composition via `PlayerProvider` context (`src/context/player-context.tsx`)
- Stateless playlist generation with LLM-driven Vibe Profiler and deterministic Director algorithm
- SQLite database (Drizzle ORM) backed by Cloudflare D1
- Two distinct user modes: authenticated (Google OAuth) and guest (localStorage-backed)
- Hierarchical role-based access: Public → Optional → Required → Admin (Cloudflare Access gated)

## Layers

**Presentation (Pages & Components):**

- Purpose: Render UI pages and interactive components
- Location: `src/app/(main)/`, `src/app/(main)/catalog/`, `src/app/(backstage)/backstage/`, `src/components/`
- Contains: Pages (`*.tsx` files in `src/app/`), page-owned layouts (FeedClient, CatalogClient), React components
- Depends on: Context (PlayerProvider), Hooks, API routes
- Used by: HTTP requests from browser

**API Routes (Thin Handlers):**

- Purpose: Expose endpoints following Next.js App Router conventions, enforce auth via route-config allowlist, delegate to services
- Location: `src/app/api/*/route.ts`
- Contains: Request parsing, validation via Zod, auth enforcement, SSE streaming, service delegation
- Depends on: Auth helpers, validation schemas, services (db/llm/external), rate limiting
- Used by: Client components, external services (YouTube sync)

**Services (Domain Logic):**

- Purpose: Encapsulate business logic, database queries, external API calls, LLM coordination
- Location: `src/lib/services/`, `src/lib/db/repos/`, `src/lib/pipeline/`, `src/lib/llm/`
- Contains: Game management, playlist generation, Steam sync, IGDB search, Turnstile verification, YouTube operations
- Depends on: Database (Drizzle), external APIs, constants
- Used by: API routes, hooks

**Database Layer (Drizzle + D1):**

- Purpose: Manage schema, queries, and persistence
- Location: `src/lib/db/drizzle-schema.ts`, `src/lib/db/repos/`, `src/lib/db/mappers.ts`, `src/lib/db/queries.ts`
- Contains: SQLite schema definitions, repository methods for all domain objects
- Depends on: Cloudflare D1 environment binding
- Used by: Services, repos

**Context & Hooks (Client State):**

- Purpose: Manage client-side state composition and derived data
- Location: `src/context/player-context.tsx`, `src/hooks/`
- Contains: Global state providers, custom hooks for playlist/player/config/library/games
- Depends on: API routes (for data fetching), localStorage (for persistence), YouTube IFrame API
- Used by: Components

**External Integrations:**

- Purpose: Interface with third-party services
- Location: `src/lib/services/external/` (YouTube, Steam, IGDB, Turnstile)
- Contains: API clients, token caching, error types, domain-specific logic (steam-sync.ts, igdb.ts, youtube-resolve.ts, turnstile.ts)
- Depends on: Typed env (env.ts), rate limiting, Drizzle
- Used by: Services, API routes

**Utilities & Infrastructure:**

- Purpose: Cross-cutting concerns and helpers
- Location: `src/lib/` (env.ts, route-config.ts, rate-limit.ts, sse.ts, logger.ts, concurrency.ts, validation.ts)
- Contains: Typed environment configuration, logging, rate limiting, SSE stream factory, Zod schemas
- Depends on: Standard library
- Used by: All layers

## Data Flow

**Guest Playlist Generation (stateless):**

1. FeedClient initiates `POST /api/playlist/generate` with gameSelections + config
2. Route handler validates input, checks guest IP rate limit (KV-backed sliding window)
3. `generatePlaylistForGuest()` runs: candidate gathering → director assembly (no Vibe Profiler) → track conversion
4. SSE stream sends progress events per game + final playlist data
5. Client receives playlist via event stream, hydrates PlayerProvider state

**Authenticated Playlist Generation (with Vibe Profiler + persistence):**

1. FeedClient initiates `POST /api/playlist/generate` with config (games fetched server-side)
2. Route handler acquires generation lock (prevents concurrent generations, enforces cooldown)
3. `generatePlaylist()` runs three phases:
   - **Phase 1: Candidate gathering** — `fetchGameCandidates()` loads tagged tracks per game from DB, filters by duration config
   - **Phase 2: Rubric resolution** — `generateRubric()` calls Vibe Profiler LLM (if cache miss), caches result per game set; energy modes skip this entirely
   - **Phase 3: Director assembly** — `assemblePlaylist()` deterministically orders tracks via scoring (arc phase matching, game balance, view bias), produces `TrackDecision` records (Director telemetry)
4. Results persisted: `playlists` + `playlist_tracks` rows + `playlist_track_decisions` (telemetry) + session name via parallel LLM call
5. SSE stream sends events, finally returns playlist ID
6. Client refreshes context to fetch new playlist

**Playback State Persistence (YouTube IFrame):**

1. `PlayerProvider` mounts `useYouTubePlayer()` hook (module-level singleton YouTube IFrame instance)
2. On track change, hook fires `onTimeUpdate` → `savePlaybackState()` writes to localStorage every ~5s
3. On pause, `patchPausedState()` writes immediately (closure issue mitigation)
4. On mount, `restoreData` memo reads cached playback from localStorage, validates video ID match
5. For authenticated users: skips guest cache; for guests: always restores unless mismatched
6. Hook restores seek position and pause state (note: YouTube API auto-plays despite `startPaused` param)

**Game Library Management (dual-path):**

1. For **authenticated users**: `useGameLibrary(isSignedIn: true)` reads/writes via API (`/api/games`)
2. For **guests**: `useGameLibrary(isSignedIn: false)` reads/writes to localStorage (`bgm_guest_library`), hydrates full Game objects from `/api/games/catalog`
3. Adding a game calls `addGame()` → branching path (API or localStorage) → state update → re-render
4. Curation mode is stored per-game and used by playlist generation (lite/include/focus affect track budget)

**Steam Library Sync (discovery aid):**

1. User navigates to catalog, initiates Steam sync via `useSteamLibrary()` hook
2. Route handler (`POST /api/steam/sync`) validates Turnstile token, enforces 1-hour cooldown via `users.steam_synced_at`
3. Service fetches public library via Steam Web API, matches to BGMancer catalog by `steam_appid`, persists matched game IDs
4. Response includes `catalogMatches` and `cooldownMinutes`; client displays on catalog as filter overlay
5. Unlink route (`DELETE /api/steam/link`) atomically clears `users.steam_id`/`steam_synced_at` + deletes `user_steam_games` rows

**Route Auth Enforcement (two-layer):**

1. **Middleware layer** (`src/middleware.ts`): reads `route-config.ts`, blocks unregistered routes with 404, requires Cloudflare Access token for Admin routes in production
2. **Handler layer** (`src/lib/services/auth/route-wrappers.ts`): `withRequiredAuth()` / `withOptionalAuth()` wrappers call `getAuthSession()`, enforce user presence for Required auth
3. Unauthenticated Required routes return 401
4. Unregistered routes return 404 (no auth header leaks)

**LLM Coordination (three providers):**

1. **Tagging Provider** (`getTaggingProvider()`) — used during backstage onboarding (phase 2 & 3)
2. **Vibe Profiler Provider** (`getVibeProfilerProvider()`) — used during authenticated playlist generation (Journey mode only)
3. **Session Naming Provider** (`getSessionNamingProvider()`) — used during authenticated playlist generation (all modes, not gated by cap)
4. Each provider encapsulates API key, model override, and request retry logic
5. Daily cap (`USER_DAILY_LLM_CAP = 10`) enforced via `acquireLlmGeneration()`, checked silently (fallback on cap exceeded)

## Key Abstractions

**Player (YouTube IFrame Integration):**

- Purpose: Unified playback interface abstracting YouTube API
- Examples: `src/hooks/player/useYouTubePlayer.ts`, `src/context/player-context.tsx`
- Pattern: Module-level singleton `ytPlayer` reference, exposes `MediaState` interface (isPlaying, currentTime, volume, seekTo, etc.)
- Mounted by `PlayerProvider`, consumed by components via `usePlayerContext().media`

**Playlist Tracks (with Decision Metadata):**

- Purpose: Represent a single selected track, carry decision score components and arc phase
- Examples: `PlaylistTrack` type with `arc_phase` left-join from `playlist_track_decisions`
- Pattern: Query result includes decision data; UI uses arc_phase for subtle spacing (no labels shown)
- Energy modes always tag with `arc_phase = "steady"` so spacing is absent

**Rubric (Vibe Profiler Output):**

- Purpose: Parameterize Director arc template per session based on game mood/energy distribution
- Examples: `src/lib/pipeline/generation/vibe-profiler.ts`, cached in `playlists.rubric` (JSON)
- Pattern: LLM generates per-game mood profiles → aggregates to game-set rubric → Director uses to sharpen arc template
- Cache hit key: sorted game IDs; cache misses consume daily LLM cap

**Arc Template (Director Assembly Guide):**

- Purpose: Define playlist structure (phases, slot budgets, energy targets)
- Examples: `JOURNEY_ARC_TEMPLATE` (six phases), `CHILL_ARC_TEMPLATE` (single Steady phase), energy mode templates
- Pattern: Phases contain ArcSlots (mood/instrument constraints); Director fills slots deterministically
- Energy modes pass `allowLastResort: false` so unmatched slots compact out (shorter playlists)

**Director (Deterministic Playlist Assembly):**

- Purpose: Assemble final ordered track list from candidate pool
- Examples: `src/lib/pipeline/generation/director/index.ts`, scoring in `constants.ts`
- Pattern: Scores each track (energy match, cross-game balance, view bias, arc phase precedence) → fills arc slots deterministically
- No randomness; same inputs always produce same output; produces `TrackDecision` records for telemetry
- Entry point: `assemblePlaylist(taggedPools, games, targetCount, rubric, arcTemplate, options?)`

**Review Flags (Metadata Quality Gates):**

- Purpose: Mark games needing manual review when onboarding encounters bad data
- Examples: `src/lib/db/repos/review-flags.ts`, set by pipeline when no usable tracks or fetch fails
- Pattern: `ReviewFlags.markAsNeedsReview(gameId, reason, detail?)` sets `games.needs_review = 1` + inserts row
- Backstage displays flagged games; operators correct metadata + clear flags via `DELETE /api/backstage/review-flags`

**Generation Lock (Concurrency Control):**

- Purpose: Prevent concurrent playlist generations per user, enforce cooldown
- Examples: `Users.tryAcquireGenerationLock(userId, cooldownMs)`, `Users.releaseGenerationLock(userId)`
- Pattern: DB-backed atomic lock using `users.is_generating` flag + `users.last_generated_at` timestamp
- Route handler acquires before pipeline; releases in finally block
- Returns structured error with retry-after if cooldown active

## Entry Points

**Main Feed Page:**

- Location: `src/app/(main)/page.tsx` + `src/app/(main)/FeedClient.tsx`
- Triggers: HTTP GET `/`
- Responsibilities: Server component fetches initial games/tracks, passes to PlayerProvider; client component renders Launchpad or Playlist layout

**Catalog Page:**

- Location: `src/app/(main)/catalog/page.tsx` + `src/app/(main)/catalog/CatalogClient.tsx`
- Triggers: HTTP GET `/catalog`
- Responsibilities: Server component fetches published game catalog; client component renders grid + library drawer + Steam sync integration

**Backstage Dashboard:**

- Location: `src/app/(backstage)/backstage/` (games, tracks, theatre, requests pages)
- Triggers: HTTP GET `/backstage/*` (Admin auth required)
- Responsibilities: Page-per-view (games list, track editor, Director telemetry, game request queue)

**Playlist Generation Endpoint:**

- Location: `src/app/api/playlist/generate/route.ts`
- Triggers: `POST /api/playlist/generate` with optional body (`target_track_count`, `playlist_mode`, `allow_long_tracks`, `allow_short_tracks`)
- Responsibilities: Validate input, enforce auth/rate limits, run pipeline, stream SSE events

**Authentication Endpoints:**

- Location: `src/app/api/auth/[...nextauth]/route.ts`
- Triggers: `POST /api/auth/signin`, `GET /api/auth/callback/google`, etc.
- Responsibilities: NextAuth v5 routes; sign-in with Google (prod) or Credentials (dev)

## Error Handling

**Strategy:** Errors are caught at route boundaries, logged, and returned as JSON or SSE error events. Services throw typed errors; routes handle and translate to HTTP responses.

**Patterns:**

- **External API failures:** Return SSE error event or 500 JSON; client receives structured error with reason (YouTube quota, Steam profile private, IGDB down, etc.)
- **Auth failures:** Return 401 for Required routes (via `AuthRequiredError`), 404 for unregistered routes or Cloudflare Access failures (identity opaque)
- **Validation failures:** Return 400 with Zod error details (auth=Public) or 401 (auth=Required, validate after auth enforcement)
- **Database failures:** Log error, return generic 500 (never expose DB schema/constraint details)
- **Rate limit breaches:** Return 429 with `Retry-After` header (guest IP limit) or structured `{ cooldownMinutes }` response (generation cooldown)
- **LLM cap exceeded:** Silently continue with fallback (default arc template for Vibe Profiler, concatenated name for session naming)
- **SSE stream errors:** Send `{ type: "error", message }` event; stream closes after

## Cross-Cutting Concerns

**Logging:** `createLogger(name)` factory in `src/lib/logger.ts` creates scoped loggers. Used in services, API handlers, and hooks. Logs include structured fields (gameId, userId, etc.) and full error objects in development.

**Validation:** All POST/PATCH/DELETE routes validate request bodies via Zod schemas defined in `src/lib/validation.ts`. Schemas co-located with types for discoverability. Failures return 400 or 401 (auth-gated routes).

**Authentication:** NextAuth v5 session-based; `auth()` function called by server components and route wrappers returns `Session | null`. Route config declarative; middleware enforces allowlist; handlers enforce presence for Required auth.

**Rate Limiting:** IP-keyed rate limits via KV-backed sliding window (guests, IGDB search, game requests). User-keyed generation cooldown via DB (atomic compare-and-swap on `users.is_generating` + `last_generated_at`). Constants in `src/lib/constants.ts`.

**Environment Configuration:** Typed lazy-loaded singleton `env` from `src/lib/env.ts`. Never use `process.env` directly. Validates required vars at startup (NEXTAUTH_SECRET, YOUTUBE_API_KEY, ANTHROPIC_API_KEY). Optional vars degrade gracefully (IGDB credentials, game request form hidden server-side).

---

_Architecture analysis: 2026-04-17_
