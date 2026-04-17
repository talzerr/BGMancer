# Codebase Structure

**Analysis Date:** 2026-04-17

## Directory Layout

```
/Users/talkoviazin/dev/BGMancer/
├── .planning/                      # GSD planning output
├── .claude/                        # Claude project context
├── .github/                        # GitHub workflows and CI/CD
├── .husky/                         # Git hooks (lint, format on commit)
├── .next/                          # Next.js build output (gitignored)
├── .wrangler/                      # Wrangler dev server state
├── .superpowers/                   # Superpowers CLI config
├── coverage/                       # Test coverage reports (gitignored)
├── docs/                           # Project documentation
├── drizzle/                        # Database migrations
├── node_modules/                   # Dependencies (gitignored)
├── public/                         # Static assets (favicons, icons, fonts)
├── src/                            # Source code (main entry point)
├── CLAUDE.md                       # Project guidelines and architecture reference
├── DIRECTOR.md                     # Detailed Director algorithm documentation
├── BACKLOG.md                      # Product backlog
├── package.json                    # Dependencies and scripts
├── tsconfig.json                   # TypeScript configuration
├── next.config.ts                  # Next.js configuration (OpenNext Cloudflare)
├── wrangler.jsonc                  # Cloudflare Workers config
├── drizzle.config.ts               # Drizzle ORM config
└── vitest.config.ts                # Vitest test runner config
```

## Directory Purposes

**src/**

- Purpose: All application source code (pages, components, APIs, services, hooks, utilities)
- Contains: TypeScript/TSX files, organized by feature + layer
- Key files: `middleware.ts` (auth enforcement), `types/index.ts` (type definitions)

**src/app/**

- Purpose: Next.js App Router pages and API routes
- Contains: Page components (`.tsx`), API handlers (`route.ts`), page-specific layouts
- Structured as: `(layout-group)/path/page.tsx` (grouped routes share layout), `api/path/route.ts` (API endpoints)

**src/app/(main)/**

- Purpose: Main user-facing pages (home feed and catalog)
- Contains: FeedClient.tsx, CatalogClient.tsx (large client components), page.tsx entry points
- Key files:
  - `page.tsx` — server component for `/`, fetches initial games/tracks
  - `FeedClient.tsx` — complex client component managing Launchpad/Playlist layout modes, generation flow
  - `catalog/page.tsx`, `catalog/CatalogClient.tsx` — game browser, library drawer, Steam sync

**src/app/(backstage)/backstage/**

- Purpose: Admin control plane for game/track management, generation telemetry
- Contains: Four main views (games, tracks, theatre, requests), each with page.tsx + \_components + \_hooks
- Key files:
  - `games/page.tsx` — game list with onboarding phase badges, need-review flags
  - `games/[slug]/page.tsx` — single game detail, track multi-select, re-ingest/retag/publish actions
  - `tracks/page.tsx` — full track table with tag edit UI, bulk actions
  - `theatre/page.tsx` — Director telemetry per session (score breakdown, arc phase audit)
  - `requests/page.tsx` — IGDB game request queue, acknowledge workflow

**src/app/api/**

- Purpose: API route handlers (thin request/response layer delegating to services)
- Contains: `route.ts` files under resource paths (e.g., `games/route.ts`, `playlist/generate/route.ts`)
- Pattern: Each route validates input (Zod), enforces auth (route wrappers), calls service, returns response/SSE stream
- Auth levels declared in `src/lib/route-config.ts` (Public/Optional/Required/Admin)

**src/app/api/playlist/generate/**

- Purpose: Endpoint for guest + authenticated playlist generation
- Key files: `route.ts` — branches on auth level, runs `generatePlaylist()` or `generatePlaylistForGuest()`, streams SSE events

**src/app/api/backstage/**

- Purpose: Admin-only endpoints for game onboarding, track tagging, telemetry retrieval
- Contains: Onboarding pipeline (load-tracks, import-tracks, resolve, retag, publish), track editor (tracks), game CRUD, theatre telemetry, game requests, Steam helpers
- Key files:
  - `games/route.ts`, `games/[gameId]/route.ts` — game CRUD + onboarding phase management
  - `load-tracks/`, `resolve/`, `retag/` — SSE-streaming pipeline phases
  - `tracks/route.ts` — bulk track query/edit
  - `theatre/[playlistId]/route.ts` — full playlist telemetry (decisions + budgets)

**src/components/**

- Purpose: Reusable React components (UI, layout, feature-specific)
- Contains: Subdirectories per feature/domain, `__tests__` per subdirectory for co-located unit tests
- Key subdirectories:
  - `ui/` — primitive UI components (buttons, modals, inputs, tooltips, etc.) from shadcn/ui
  - `layout/` — shared layout pieces (LogoLink, FooterLinks, not full page layouts)
  - `launchpad/` — Launchpad onboarding screen (empty state, curation mode presets)
  - `generate/` — Generation UI (size selector, mode picker, advanced options)
  - `library/` — Game library management (LibraryWidget, GameRequestPrompt, curation toggles)
  - `player/` — YouTube player panel (compact 80px sidebar, controls, volume)
  - `session/` — Session history, archive/rename/delete actions
  - `backstage/` — Admin-specific components (game editor, track table, theatre charts)

**src/context/**

- Purpose: React Context providers for global state
- Key files: `player-context.tsx` — composes all global state (playlist, player, config, gameLibrary), exposes via `usePlayerContext()`

**src/hooks/**

- Purpose: Custom React hooks for state management and data fetching
- Contains: Subdirectories per domain (`player/`, `library/`, `config/`, `shared/`, `backstage/`)
- Key hooks:
  - `player/usePlaylist.ts` — playlist tracks + session management, fetches from API
  - `player/usePlayerState.ts` — playback state (current track, shuffle, revealed tracks, pause)
  - `player/useYouTubePlayer.ts` — YouTube IFrame player singleton, playback control
  - `config/useConfig.ts` — localStorage-backed app config (track count, anti-spoiler, playlist mode)
  - `library/useGameLibrary.ts` — dual-path (API vs localStorage) game library management
  - `library/useSteamLibrary.ts` — Steam library sync state and mutations
  - `shared/useTurnstileToken.ts` — Cloudflare Turnstile widget integration

**src/lib/**

- Purpose: Core services, utilities, and infrastructure
- Key subdirectories:
  - `db/` — database layer (Drizzle schema, repos, mappers, queries)
  - `services/` — business logic (auth, external APIs, parsing)
  - `pipeline/` — playlist generation (generation/, onboarding/)
  - `llm/` — LLM provider abstraction and calls (tagging, vibe profiler, session naming)

**src/lib/db/**

- Purpose: Database schema, repositories, and query helpers
- Key files:
  - `drizzle-schema.ts` — SQLite schema definition (tables: users, games, playlists, playlist_tracks, tracks, etc.)
  - `repo.ts` — barrel export of all repositories
  - `repos/*.ts` — one file per domain (games.ts, sessions.ts, playlist.ts, tracks.ts, etc.)
  - `mappers.ts` — row-to-typed-object converters (used by raw SQL queries)
  - `queries.ts` — shared Drizzle subquery builders
  - `test-helpers.ts` — `createTestDrizzleDB()` for in-memory SQLite test databases

**src/lib/services/**

- Purpose: Encapsulate domain logic, external integrations, cross-cutting concerns
- Subdirectories:
  - `auth/` — NextAuth config, session handling, route wrappers, auth helpers, Cloudflare Access check
  - `external/` — third-party APIs (YouTube, Steam, IGDB, Turnstile, tracklist sources)
  - `infra/` — infrastructure utilities (rate limiting KV interactions, error handling)
  - `parsing/` — tracklist source parsing (Discogs, VGMdb, manual)

**src/lib/pipeline/**

- Purpose: Playlist generation pipeline
- Subdirectories:
  - `generation/` — playlist assembly (candidates, vibe-profiler, director, session-naming)
  - `onboarding/` — game onboarding (load tracks, resolve videos, tag tracks)

**src/lib/pipeline/generation/director/**

- Purpose: Deterministic playlist assembly algorithm
- Key files:
  - `index.ts` — `assemblePlaylist()` main entry point, scoring logic, track selection
  - `constants.ts` — scoring weights (energy, game balance, view bias, penalties)
  - `types.ts` — ArcSlot, ArcTemplate, ArcPhase type definitions
  - `arc-templates/` — concrete arc template definitions (journey, chill, mix, rush)

**src/lib/llm/**

- Purpose: LLM provider abstraction and calls
- Key files:
  - `index.ts` — exports three providers: tagging, vibe-profiler, session-naming
  - `provider.ts` — `LLMProvider` interface and Anthropic implementation

**src/lib/playlist-mode/**

- Purpose: Playlist mode utility functions and types
- Key files: Mode-specific logic (energy templates, arc parameterization)

**src/types/index.ts**

- Purpose: Central type definitions for the entire app
- Contains: User, PlaylistSession, Game, PlaylistTrack, CurationMode, PlaylistMode, TrackMood, TrackInstrumentation, enums (BackstageModal, OnboardingPhase, ReviewReason, etc.)

**src/lib/env.ts**

- Purpose: Typed, lazy-loaded environment configuration singleton
- Validates required vars (NEXTAUTH_SECRET, YOUTUBE_API_KEY, ANTHROPIC_API_KEY) at first access
- Pattern: `import { env } from "@/lib/env"` everywhere instead of `process.env`

**src/lib/route-config.ts**

- Purpose: Declarative single source of truth for all accessible routes (pages + APIs)
- Contains: `routeConfig` object mapping "METHOD /path" → `{ auth: AuthLevel }`
- Pattern: Unregistered routes return 404; auth levels enforced in middleware + route handlers

**src/lib/validation.ts**

- Purpose: Zod schemas for all POST/PATCH/DELETE request bodies
- Key schemas: `generateSchema`, `addGameSchema`, `updateCurationSchema`, etc.

**src/lib/rate-limit.ts**

- Purpose: IP-keyed rate limiting (KV-backed sliding window) and user-keyed generation cooldown
- Key functions: `checkGuestRateLimit()`, `acquireLlmGeneration()`, `releaseGenerationLock()`

**src/lib/sse.ts**

- Purpose: Server-Sent Events stream factory for long-running operations (generation, onboarding)
- Key function: `makeSSEStream<T>()` returns `{ stream, send, close }`

**src/lib/constants.ts**

- Purpose: Application constants (cooldowns, durations, defaults, limits)
- Key constants: `GENERATION_COOLDOWN_MS`, `DEFAULT_TRACK_COUNT`, `GUEST_SESSION_ID`, `USER_DAILY_LLM_CAP`

**src/lib/playback-state.ts**

- Purpose: localStorage persistence for playback position, current track, pause state
- Key functions: `savePlaybackState()`, `readPlaybackState()`, `savePlaybackTracks()`, `readPlaybackTracks()`
- Keys: `bgm_playback_state`, `bgm_playback_tracks`, `bgm_revealed_tracks`

**src/lib/guest-library.ts**

- Purpose: localStorage persistence for guest game library
- Key functions: `saveGuestLibrary()`, `readGuestLibrary()`, `clearGuestLibrary()`
- Key: `bgm_guest_library` (JSON array of `{ gameId, curation }`)

**src/lib/logger.ts**

- Purpose: Scoped logging with structured fields
- Pattern: `createLogger(name)` returns logger with `info()`, `error()`, `debug()` methods

**src/middleware.ts**

- Purpose: Next.js middleware for auth enforcement and routing
- Responsibilities: Route allowlist validation (404 for unregistered), Cloudflare Access check for Admin routes

**drizzle/migrations/**

- Purpose: Incremental database migrations (auto-generated by Drizzle Kit)
- Key files: Numbered `.sql` files, applied via `pnpm db:migrate` (local) or `wrangler d1 migrations apply` (prod)

**public/**

- Purpose: Static assets served directly by the edge
- Contains: App icons (icon-512.png, favicon), fonts (embedded via Google Fonts in layout.tsx)

**docs/**

- Purpose: Internal project documentation (design system, architecture deep-dives)

## Key File Locations

**Entry Points:**

- `src/app/layout.tsx`: Root HTML layout, font loading
- `src/app/(main)/layout.tsx`: Main app layout, PlayerProvider wrapper, initial data fetch
- `src/app/(main)/page.tsx`: Home feed page, server component
- `src/app/api/playlist/generate/route.ts`: Playlist generation endpoint

**Configuration:**

- `.env.local`: Local development secrets (not committed)
- `.env.local.example`: Template for required env vars
- `tsconfig.json`: TypeScript compiler options
- `next.config.ts`: Next.js build config (OpenNext Cloudflare adapter)
- `wrangler.jsonc`: Cloudflare Workers deployment config
- `drizzle.config.ts`: Drizzle ORM config (migrations, schema, driver)
- `vitest.config.ts`: Vitest test runner config

**Core Logic:**

- `src/lib/db/drizzle-schema.ts`: Database schema definition
- `src/lib/db/repo.ts`: Database repository barrel export
- `src/lib/pipeline/generation/index.ts`: Main playlist generation entry point
- `src/lib/pipeline/generation/director/index.ts`: Deterministic Director algorithm
- `src/lib/services/auth/auth.ts`: NextAuth v5 configuration
- `src/lib/env.ts`: Typed environment singleton

**Testing:**

- `src/**/__tests__/`: Co-located test files (one `__tests__` dir per feature directory)
- `src/lib/db/test-helpers.ts`: Test database factory
- `vitest.config.ts`: Vitest configuration
- `coverage/`: Generated coverage reports (gitignored)

## Naming Conventions

**Files:**

- API routes: `route.ts` (always — no numbered suffixes)
- Client components: End with `Client.tsx` (e.g., `FeedClient.tsx`) to denote "use client"
- Server components: End with `.tsx` (implicit, no marker; `page.tsx` is always server by default)
- Hooks: Start with `use` (e.g., `usePlaylist.ts`, `useSteamLibrary.ts`)
- Test files: End with `.test.ts` or `.test.tsx`
- Repos: Domain name (e.g., `games.ts`, `sessions.ts`, `tracks.ts`)
- Components: PascalCase directory, PascalCase component name

**Directories:**

- Feature directories: kebab-case (e.g., `library`, `player`, `backstage`, `generate`)
- Grouped routes: Parentheses for Next.js layout groups (e.g., `(main)`, `(backstage)`)
- API paths: Follow REST convention (e.g., `api/playlist/[id]/reroll`)
- Private/utility dirs: Single underscore prefix optional, avoided in favor of explicit nesting

**Variables & Functions:**

- camelCase for functions, variables, properties
- PascalCase for classes, types, interfaces, enums
- SCREAMING_SNAKE_CASE for constants
- Enum values: camelCase in TypeScript, mapped to lowercase/kebab-case in database strings

**Type Names:**

- Plain nouns for interfaces (e.g., `Game`, `PlaylistTrack`, `User`)
- Verb phrases for state snapshots (e.g., `PlaylistState`, `PlayerState`)
- Verb phrases for result tuples (e.g., `AuthResult`)
- Enum values: CapitalizedWords (TypeScript enum key), lowercase-kebab-case (wire format, DB values)

## Where to Add New Code

**New API Endpoint:**

1. Create `src/app/api/resource/[optional-param]/route.ts`
2. Add entry to `src/lib/route-config.ts` with format `"METHOD /api/resource/[optional-param]": { auth: AuthLevel.X }`
3. Add Zod schema to `src/lib/validation.ts` if endpoint accepts a body
4. Use auth wrapper: `withRequiredAuth(handler, "operation-name")` or `withOptionalAuth(handler, "operation-name")`
5. Delegate to service layer (create service function if needed)
6. Add tests to `src/app/api/resource/__tests__/route.test.ts`

**New Page:**

1. Create `src/app/(group)/path/page.tsx` as server component (or `layout.tsx` if it needs a layout)
2. Add entry to `src/lib/route-config.ts` with key `/path` (always `{ auth: AuthLevel.Public }` unless auth-gated)
3. If page needs client state, add `"use client"` directive
4. If page is large/complex, extract client-side logic to `PathClient.tsx`
5. Middleware handles route allowlist; no explicit auth decorators needed on pages (auth enforced in API routes called by page)

**New Component:**

1. Create `src/components/feature/Component.tsx` in appropriate feature subdirectory
2. If component uses hooks/context (stateful), add `"use client"` at top
3. Add tests to `src/components/feature/__tests__/Component.test.tsx`
4. If component is a layout piece (header, footer, sidebar), place in `src/components/layout/`
5. If component is UI primitive (button, modal, input), place in `src/components/ui/` (prefer shadcn/ui presets)

**New Hook:**

1. Create `src/hooks/domain/useFeature.ts` in appropriate domain subdirectory
2. Hooks can call API routes (`fetch()`) or use context (`usePlayerContext()`)
3. Export from hook module; consume in components via `import { useFeature } from "@/hooks/domain/useFeature"`
4. Add tests to `src/hooks/domain/__tests__/useFeature.test.ts`

**New Service:**

1. Create `src/lib/services/domain/feature.ts` (or add to existing domain service)
2. Services encapsulate business logic, database queries, external API calls
3. Export typed functions and error classes
4. Use `createLogger(name)` for logging
5. Add tests to `src/lib/services/domain/__tests__/feature.test.ts`

**New Database Table:**

1. Edit `src/lib/db/drizzle-schema.ts` — add table definition using Drizzle SQL builders
2. Run `pnpm db:generate` — Drizzle Kit diffs and creates a new migration
3. Run `pnpm db:migrate` — apply migration to local D1
4. Create `src/lib/db/repos/domain.ts` with repository methods (query, insert, update, delete)
5. Export from `src/lib/db/repo.ts` barrel
6. Add tests to `src/lib/db/repos/__tests__/domain.test.ts`

**New Environment Variable:**

1. Add to `.env.local.example` as template
2. Update `src/lib/env.ts` — add to `Env` interface, handle in `loadEnv()` function
3. Use via `import { env } from "@/lib/env"; env.myVariable`
4. Never use `process.env` directly

**New Type:**

1. Add to `src/types/index.ts` (central location, no splitting across files)
2. Use interfaces for objects, enums for named value sets
3. Document with JSDoc comments for public types

**New Validation Schema:**

1. Add to `src/lib/validation.ts` as new `const schemaName = z.object({ ... })`
2. Use same property names as the type it validates (convention for clarity)
3. Reference in API route handler: `const parsed = schemaName.safeParse(body)`

## Special Directories

**node_modules/**

- Purpose: npm dependencies
- Generated: Yes (via `pnpm install`)
- Committed: No (gitignored)

**.next/**

- Purpose: Next.js build output
- Generated: Yes (via `pnpm build`)
- Committed: No (gitignored)

**coverage/**

- Purpose: Test coverage reports
- Generated: Yes (via `pnpm test:coverage`)
- Committed: No (gitignored)

**drizzle/migrations/**

- Purpose: Incremental database migrations
- Generated: Yes (via `pnpm db:generate`)
- Committed: Yes (important for production deploy)

**public/**

- Purpose: Static assets served by edge
- Generated: No (hand-curated)
- Committed: Yes

---

_Structure analysis: 2026-04-17_
