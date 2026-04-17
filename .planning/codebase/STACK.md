# Technology Stack

**Analysis Date:** 2026-04-17

## Languages

**Primary:**

- TypeScript 5.9.3 - All application code, both server and client
- JSX (React 19.2.4) - UI components

**Secondary:**

- JavaScript/MHTML - CSS and configuration files
- SQL - SQLite database queries via Drizzle ORM

## Runtime

**Environment:**

- Node.js 22+ (required, see `package.json` engines)
- Cloudflare Workers (deployment target via @opennextjs/cloudflare)

**Package Manager:**

- pnpm 10.33.0
- Lockfile: `pnpm-lock.yaml` (present)

## Frameworks

**Core:**

- Next.js 16.2.1 - Full-stack framework with App Router
- React 19.2.4 - UI library
- Tailwind CSS 4.2.1 - Utility-first CSS framework

**Database & ORM:**

- Drizzle ORM 0.45.2 - TypeScript ORM for SQLite
- Drizzle Kit 0.31.10 - Migration generation and schema management
- Cloudflare D1 - SQLite database service (local dev via miniflare, production via Workers binding)

**Authentication:**

- NextAuth 5.0.0-beta.30 - Session management with JWT strategy
- Google OAuth 2.0 (production) / Credentials provider (dev)

**Testing:**

- Vitest 4.1.2 - Unit and integration test runner
- @testing-library/react 16.3.2 - Component testing utilities
- jsdom 29.0.1 - DOM environment for tests
- better-sqlite3 12.8.0 - In-memory SQLite for test databases
- @vitest/coverage-v8 4.1.2 - Code coverage (targets 100% for `src/lib/**/*.ts`)

**Build & Dev:**

- Turbopack - Fast build and dev mode (via `next dev --turbopack`)
- OpenNext 1.18.0 (@opennextjs/cloudflare) - Next.js to Cloudflare Workers adapter
- TypeScript Compiler - Type checking (strict mode)
- ESLint 9.39.4 - Code linting
- Prettier 3.8.1 - Code formatting
- Husky 9.1.7 - Git hooks for pre-commit lint + format

**UI Components & Interaction:**

- @base-ui/react 1.3.0 - Unstyled component primitives (popover, menu)
- @dnd-kit/core 6.3.1, @dnd-kit/sortable 10.0.0 - Drag-and-drop for playlist reordering
- lucide-react 0.577.0 - Icon library
- class-variance-authority 0.7.1 - CSS class composition
- clsx 2.1.1 - Conditional className utilities
- tailwind-merge 3.5.0 - Tailwind class merging
- tw-animate-css 1.4.0 - Tailwind animation utilities

**Data Validation & Serialization:**

- Zod 4.3.6 - Schema validation for API inputs
- jose 6.2.2 - JWT token handling (NextAuth compatibility)
- uuidv7 1.2.1 - UUID v7 generation for entity IDs

**LLM Integration:**

- @anthropic-ai/sdk 0.82.0 - Anthropic Claude API client

## Key Dependencies

**Critical:**

- drizzle-orm, drizzle-kit - Required for database schema management and queries
- next-auth - Centralized authentication for all auth levels (Public/Optional/Required/Admin)
- @anthropic-ai/sdk - Powers all LLM calls: track tagging, vibe profiling, session naming
- zod - Input validation for all POST/PATCH/DELETE routes

**Infrastructure:**

- @opennextjs/cloudflare - Cloudflare Workers adapter (production deployment)
- better-sqlite3 - In-memory test databases with D1 compatibility wrapper

**External Service Clients:**

- None as npm packages; all external APIs (YouTube, Steam, IGDB, Discogs) use native fetch()

## Configuration

**Environment:**

- Centralized in `src/lib/env.ts` - Single source of truth for all environment variables
- Lazy-loaded singleton pattern - Read on first access (required for Cloudflare Workers)
- Required env vars: `NEXTAUTH_SECRET`, `YOUTUBE_API_KEY`, `ANTHROPIC_API_KEY`
- Optional: `GOOGLE_CLIENT_ID/SECRET` (prod), `STEAM_API_KEY`, `DISCOGS_TOKEN`, `IGDB_CLIENT_ID/SECRET`, `TURNSTILE_SITE_KEY/SECRET_KEY`

**Build Configuration:**

- `tsconfig.json` - TypeScript strict mode, @/\* path alias
- `next.config.ts - Image optimization disabled (unoptimized), CSP headers, development setup
- `vitest.config.ts` - Separate projects for node and jsdom environments, 100% coverage targets
- `.prettierrc` - 100-char print width, trailing commas, no semicolons (singleQuote: false but uses "")
- `eslint.config.mjs` - Next.js ESLint configuration

**Database:**

- `drizzle.config.ts` - Points to `src/lib/db/drizzle-schema.ts` and `drizzle/migrations/`
- Migrations stored in `drizzle/migrations/` - Applied via `pnpm db:migrate` (local) or `wrangler d1 migrations apply` (production)

## Platform Requirements

**Development:**

- Node.js 22+
- pnpm 10.33.0
- `.env.local` file (copy from `.env.local.example`) with required API keys
- OpenSSL (for generating NEXTAUTH_SECRET)

**Production:**

- Cloudflare Workers (compute)
- Cloudflare D1 (SQLite database)
- Cloudflare KV (rate limiting and caching)
- Cloudflare Turnstile (bot verification)
- Cloudflare Access (backstage route protection)

**Third-Party Integrations:**

- Google Cloud Project (YouTube Data API v3, Google OAuth)
- Steam API (for library import)
- Anthropic Claude API (for LLM calls)
- Twitch Developer Console (IGDB credentials)
- Cloudflare (Turnstile, KV, D1, Workers, Assets)
- Discogs API (optional, for tracklist loading with higher rate limit)

---

_Stack analysis: 2026-04-17_
