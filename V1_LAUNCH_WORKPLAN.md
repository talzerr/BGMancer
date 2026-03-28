# BGMancer — V1.0 Production Readiness Workplan

> **This document is the single source of truth for launching BGMancer v1.0.** A new agent session can read this file and begin implementation on any milestone immediately. Supersedes the old `PRODUCTION_HARDENING_WORKDOC.md`.

## Context

BGMancer is feature-complete and needs to move from a local single-user Mac setup to a public, multi-user Cloudflare deployment. The app is open-source (MIT). There's one admin (the owner). The domain is `bgmancer.com`.

**Project posture:** This is a passion project shared with the world, not a commercial product. There are no monetization plans — at most a "buy me a coffee" link if traffic and expenses justify it. The tone of the app (docs, legal pages, error messages) should reflect this: friendly, honest, low-ceremony. Don't over-engineer for scale or legal edge cases that only matter for commercial SaaS. Security and reliability still matter — but formality and legal armor do not.

The single biggest architectural challenge: the entire database layer uses synchronous `better-sqlite3`, which cannot run on Cloudflare Workers. This cascades into nearly every other decision.

---

## Resolved Decisions

These decisions were made during planning and should not be revisited without good reason.

- **Backstage deployment:** Single Worker, Cloudflare Access on `backstage.bgmancer.com`
- **Guest generation:** Yes, Director-only (no Vibe Profiler)
- **License:** MIT for code, BGMancer name is creator's
- **Per-user cap:** 10 generations/day, configurable via admin DB setting with per-user overrides
- **Anthropic budget:** $50/month starting, adjust based on real data
- **YouTube API:** Admin-only (onboarding), not user-facing
- **Data retention:** Guests = browser-only, logged-in = 30 days inactive cleanup
- **Auth:** Google OAuth for logged-in users
- **Admin access:** Single admin (owner), Cloudflare Access
- **No SSH:** Use `wrangler d1 execute`, admin API endpoints, and local scripts instead
- **Non-commercial posture:** Hobby project, no monetization plans, at most a "buy me a coffee" link. Legal and observability should be proportional — lightweight and honest, not enterprise-grade.

---

## Phase 0 — Foundation

These items create the safety net needed before major refactors begin. Nothing else should start until Phase 0 is complete.

### 0.1 Testing Infrastructure

**Why it matters:** You're about to rewrite the database layer, change the auth system, and restructure middleware. Without tests, you'll have no way to know if refactors broke existing behavior. Tests are insurance — they're most valuable _before_ the risky work, not after.

**Scope:**

- Install and configure Vitest with TypeScript + `@/` path alias
- Add `test`, `test:watch`, `test:coverage` npm scripts
- Write unit tests for pure functions: `parseDuration`, REJECT_KEYWORDS filtering, mapper functions, Director's `assemblePlaylist`
- Write integration tests for the repository layer using in-memory SQLite
- Write parsing tests for LLM tagger responses (malformed JSON, missing fields, out-of-range values)

**Decision questions:**

- What's your target coverage threshold? 80% of critical paths is a reasonable starting point — not 100% of everything.
- Do you want snapshot testing for the Director's arc assembly output, or just assertion-based?

---

### 0.2 CI Pipeline

**Why it matters:** CI is the guardrail that catches mistakes before they reach production. Every subsequent session in this plan will produce PRs — CI ensures they don't break the build. It's also table stakes for an open-source project; contributors expect a green checkmark.

**Scope:**

- Create `.github/workflows/ci.yml`: lint, format check, `npm audit`, build, test
- Ensure CI works with placeholder env vars (no real API keys needed for build/test)
- Add branch protection rules on `main`: require CI pass before merge

**Decision questions:**

- Do you want to gate merges on CI passing, or just have it as an advisory signal initially?

---

## Phase 1 — Database Migration

This is the single largest effort in the entire plan. It must happen before Cloudflare deployment because `better-sqlite3` (synchronous, native binary) cannot run on Workers. It also unblocks the need for a real migration system.

### 1.1 Adopt an ORM / Query Abstraction Layer

**Why it matters:** Right now, every repo file hand-writes SQL and uses the synchronous `better-sqlite3` API directly. To deploy on Cloudflare D1 (async API), every single DB call must change. An ORM like Drizzle can target _both_ better-sqlite3 (local dev) and D1 (production) from the same schema definition, so you write the migration once and get both environments working.

**Scope:**

- Evaluate and adopt Drizzle ORM (strong D1 support, TypeScript-native, lightweight)
- Define the Drizzle schema mirroring the current `CREATE TABLE` statements in `schema.ts`
- Replace the `stmt()` caching helper and raw `db.prepare()` calls with Drizzle queries
- Convert all repo files (`games.ts`, `tracks.ts`, `sessions.ts`, `playlist.ts`, `users.ts`, `video-tracks.ts`, `review-flags.ts`, `decisions.ts`) from sync to async
- Update all API route handlers to `await` the now-async repo calls
- Verify all existing tests still pass after conversion

**Decision questions:**

- Drizzle vs. Kysely vs. raw D1 API? Drizzle is recommended for its first-class D1 support and type safety. Kysely is lighter but has weaker D1 integration. Raw D1 means rewriting every query twice (once for dev, once for prod).
- Do you want to do this as one large session or split by repo domain (games, tracks, playlist, etc.)?

---

### 1.2 Database Indexing Audit

**Why it matters:** With a single user, every query is fast regardless of indexing. With hundreds of users and thousands of tracks, an unindexed query that was invisible at 100ms becomes a 2-second bottleneck. The Director queries tracks by `energy`, `role`, `mood`, and `instrumentation` during arc assembly — these need to be fast. Backstage queries filter by `status`, `needs_review`, and join across multiple tables.

**Scope:**

- Audit all `WHERE`, `JOIN`, and `ORDER BY` clauses across repo files
- Add indexes for Director-critical columns: `energy`, `role`, and any columns used in scoring queries
- Add indexes for Backstage-critical columns: `games.status`, `games.needs_review`
- Add composite indexes where multi-column filtering is common
- Verify `game_yt_playlists` lookup performance (cached playlist IDs queried on every generation)
- This must happen _before_ Phase 3 (D1 migration) since D1 index behavior differs slightly from local SQLite

**Decision questions:**

- Do you want to benchmark before/after with a realistic data volume, or trust the query patterns and add indexes proactively?

---

### 1.3 Database Migration System

**Why it matters:** Today, schema changes are made by editing `CREATE TABLE` statements and running `db:reset`, which **drops all data**. That's fine when you're the only user and the DB is disposable. In production, you can't drop everyone's game libraries every time you add a column. A migration system applies incremental schema changes without data loss.

**Scope:**

- Set up Drizzle Kit (Drizzle's migration tooling) or a lightweight alternative
- Generate an initial migration from the current schema (baseline)
- Replace the `initSchema()` function with migration runner logic
- Document the workflow: schema change → generate migration → apply
- Ensure migrations work for both local SQLite and Cloudflare D1

**Decision questions:**

- Drizzle Kit handles migration generation automatically from schema diffs — is that acceptable, or do you want hand-written SQL migrations for more control?
- What's the data seeding story for new deployments vs. existing ones?

---

## Phase 2 — Security & Auth

With the database layer modernized, security work can proceed. These items are ordered by dependency — earlier items unblock later ones.

### 2.1 User Identity & Tier System

**Why it matters:** This is the **#1 blocker for multi-user**. Right now, `src/proxy.ts` contains session-minting logic but is never imported — it's dead code. Every user falls back to `LOCAL_USER_ID`. Beyond just fixing this, the app needs a proper tier model to control what different user types can do and protect expensive API resources.

**Tier model:**

| Tier                 | Identity             | Persistence                                             | API calls                                         | Rate limits |
| -------------------- | -------------------- | ------------------------------------------------------- | ------------------------------------------------- | ----------- |
| **Guest**            | Anonymous (no login) | localStorage only, no backend state                     | None — Director assembles from pre-cached DB data | Lightest    |
| **Logged-in**        | Google OAuth         | Full backend persistence (library, sessions, playlists) | Vibe Profiler (Anthropic) during generation       | Standard    |
| **Premium** (future) | Google OAuth         | Same + expanded options                                 | Same + higher quotas                              | Relaxed     |

**Key architectural insight:** YouTube API and LLM tagging are **admin-only operations** (game onboarding in Backstage). Regular generation uses the Director (pure TypeScript) + Vibe Profiler (Anthropic, ~$0.05/generation). Guests skip even the Vibe Profiler and generate from the existing tagged pool only. This means the YouTube API quota (10,000 units/day) is not a user-facing concern — it's controlled entirely by admin onboarding pace.

**Data retention:** Guest data lives entirely in the browser (localStorage) — no backend cleanup needed. Logged-in user sessions expire after 30 days of inactivity; stale data is cleaned up automatically.

**Scope:**

- Replace the anonymous JWT cookie system with **Google OAuth via NextAuth** as the primary auth
- Guest flow: no login required, no backend session created, app works with localStorage for config/state, API routes that serve cached catalog data are public
- Logged-in flow: Google OAuth login, creates a real user record in DB, all CRUD operations tied to authenticated userId
- Create working `src/middleware.ts` that distinguishes guest vs. authenticated requests
- API routes that trigger expensive operations (generate, import, onboard) require authenticated session → return 401 for guests
- API routes that serve cached/public data (catalog, published game tracks) are open to guests
- Remove `LOCAL_USER_ID` as fallback from `getOrCreateUserId` in `session.ts`
- Delete `src/proxy.ts`
- Add `user_tier` column to users table (enum: `free`, `premium`) — default `free`, `premium` not implemented yet but schema is ready

**Decision questions:**

- Should guests see a "sign in to save your playlist" prompt after generation?
- How should the transition work when a guest signs in — merge any localStorage state into their new account, or start fresh?

---

### 2.2 JWT Hardening & Cookie Security

**Why it matters:** JWTs without expiration are permanent credentials — if one leaks, it's valid forever. The `secure` flag missing from cookies means they'll be sent over HTTP (not just HTTPS), making them interceptable. These are basic hygiene items that security auditors and open-source reviewers will flag immediately.

**Scope:**

- Add 30-day expiration to session JWTs (`.setExpirationTime('30d')`)
- Implement sliding expiry: refresh the token when <7 days remain
- Set cookie flags: `secure: true`, `sameSite: 'strict'`, `httpOnly: true`
- Handle `JWTExpired` errors gracefully (re-mint for pages, 401 for APIs)

---

### 2.3 Secrets Validation

**Why it matters:** The hardcoded fallback secret `"dev-fallback-secret-change-me"` means that if someone deploys without setting `NEXTAUTH_SECRET`, every JWT is signed with a publicly known key — anyone can forge sessions. Fail-fast on missing secrets prevents silent insecurity.

**Scope:**

- Remove the fallback secret from both `proxy.ts`/`middleware.ts` and `session.ts`
- Add startup validation: crash with a clear error if `NEXTAUTH_SECRET` or `YOUTUBE_API_KEY` is missing
- Document all required env vars in `.env.local.example` with descriptions

---

### 2.4 Ownership Checks on Mutation Routes

**Why it matters:** Without ownership checks, any user who guesses (or enumerates) a session ID or playlist ID can delete or modify another user's data. This is a classic IDOR (Insecure Direct Object Reference) vulnerability — it's in the OWASP Top 10 and is one of the first things security researchers test.

**Scope:**

- `DELETE /api/playlist/[id]` — verify track belongs to requesting user's session
- `PATCH /api/sessions/[id]` — verify `session.userId === requestingUserId`
- `DELETE /api/sessions/[id]` — same ownership check
- Return 403 Forbidden on mismatch

---

### 2.5 Backstage Admin Protection

**Why it matters:** The Backstage panel can publish/unpublish games, retag tracks (triggering expensive LLM calls), delete games, and view all user data. In production, anyone who discovers `/backstage` can do all of this. Since you're the sole admin, a simple protection mechanism is sufficient — no need for a full role system.

**Scope:**

- **Recommended approach: Cloudflare Access (Zero Trust).** This is a Cloudflare-native feature that gates access to specific URL paths behind an identity check (e.g., your Google email). It runs at the edge _before_ your Workers code executes, so even if your app has bugs, Backstage is still locked. Zero config in your app code — purely infrastructure.
- Alternative: app-level `ADMIN_SECRET` env var with a simple login flow and session cookie
- Either way: protect all `/backstage/*` pages AND all `/api/backstage/*` API routes (don't gate the UI but leave the API open)
- Return 404 (not 403) for unauthorized backstage access if using app-level auth — don't reveal the admin panel exists
- Verify no backstage operations are reachable through non-backstage API routes

**Decision questions:**

- Cloudflare Access (recommended — zero app code, edge-level, free for up to 50 users) vs. app-level shared secret? Access is more robust; shared secret is simpler to reason about.
- Should the admin session expire, and if so, how often? (Recommendation: 7 days for app-level; Cloudflare Access handles this automatically)

---

### 2.6 Input Validation (Zod)

**Why it matters:** Without schema validation, malformed or malicious input can cause crashes, unexpected behavior, or waste resources (e.g., `target_track_count: 999999` triggering an enormous generation). Zod provides type-safe runtime validation that catches bad input at the API boundary before it reaches your business logic.

**Scope:**

- Install Zod
- Add schemas to all POST/PATCH/DELETE routes
- Key validations: `target_track_count` capped at sensible max, session names length-limited, UUIDs validated, enum values checked
- Consistent error response format: `{ error: zodError.flatten() }` with 400 status

---

### 2.7 Security Headers & CORS

**Why it matters:** HTTP security headers are defense-in-depth mechanisms that browsers enforce. HSTS ensures HTTPS-only. CSP prevents XSS by controlling what scripts/resources can load. X-Frame-Options prevents clickjacking. CORS misconfiguration lets any website make API requests on behalf of your users. These are free protection that cost nothing to add and significantly raise the bar for attackers.

**Scope:**

- Add `headers()` to `next.config.ts` with: HSTS, CSP, X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy
- CSP must allow YouTube embeds (`frame-src`), YouTube thumbnails (`img-src`), and Steam CDN images
- **Configure CORS** to only accept requests from your exact production domain (and localhost for dev)
- Test thoroughly — CSP misconfiguration can break the app silently

---

### 2.8 Remove/Guard Dev Routes

**Why it matters:** Dev-only routes (`/api/dev/*`, `/api/seed/*`) expose internal debugging tools and database seeding operations. In production, these are attack vectors — they bypass normal access controls and can modify data in unexpected ways.

**Scope:**

- Remove or production-gate `GET /api/dev/yt-playlists` and `GET /api/seed/yt-playlists`
- Audit for any other dev-only routes or debug endpoints
- Consider: if any are needed for debugging, gate behind `ADMIN_SECRET`

---

### 2.9 Rate Limiting

**Why it matters:** Without rate limiting, a single user (or bot) can rack up Anthropic API costs or DoS the app. Rate limiting is your first line of defense against both abuse and accidental overuse.

**Scope:**

- For Cloudflare: use the native Workers Rate Limiting binding (near-zero latency, defined in `wrangler.toml`)
- For local dev: use an in-memory sliding window counter (lru-cache or similar)
- Rate limit tiers:
  - `POST /api/playlist/generate`: 3/10min per user
  - `POST /api/steam/import`: 5/min per user
  - `POST /api/playlist/import`: 10/min per user
  - General API: 120/min per user
  - Backstage routes: per-admin limits on LLM-triggering operations
- Return 429 with `Retry-After` header

**Decision questions:**

- Should rate limiting also apply globally (not just per-user) to protect API quotas? E.g., max 100 generations/hour across all users?
- How should you handle rate-limited users in the UI? Silent failure vs. informative message?

---

## Phase 3 — Cloudflare Deployment

With the DB migrated and security in place, deploy to Cloudflare.

### 3.1 @opennextjs/cloudflare Adapter Setup

**Why it matters:** Cloudflare Workers is not Node.js — it's a V8 isolate environment. The adapter translates Next.js's server-side behavior into something Workers can execute. Getting this right is the difference between "it works" and "half the routes 500."

**Domain:** `bgmancer.com` (owned). Target architecture:

- `bgmancer.com` — main app (public)
- `backstage.bgmancer.com` — admin panel (protected via Cloudflare Access)

**Subdomain separation for Backstage:** Use a **single Worker** serving both domains. Cloudflare Access gates `backstage.bgmancer.com` at the edge (before your code runs). This is the standard pattern for small teams — one codebase, one deployment, zero routing complexity. The Worker serves the main app on `bgmancer.com` and Backstage on the subdomain, with Cloudflare Access handling auth on the subdomain.

**Scope:**

- Install and configure `@opennextjs/cloudflare`
- Create `wrangler.toml` with `nodejs_compat` flag, compatibility date, D1 binding, rate limiter binding
- Configure custom domain: `bgmancer.com` pointed at the main Worker
- Configure `backstage.bgmancer.com` subdomain with Cloudflare Access (Zero Trust) gating your Google email
- Configure build pipeline: `next build` → adapter → `wrangler deploy`
- Verify all API routes work in the Workers environment
- Verify SSE streaming works (it should — Workers support streaming responses with no wall-time limit)
- Since YouTube API is admin-only and Vibe Profiler is a single Anthropic call per generation, the subrequest limit is less concerning than initially thought — but verify with real generation flows

**Decision questions:**

- Free vs. paid Workers plan? Free has 50 subrequests/invocation. A standard generation may stay within this since YouTube calls are admin-only, but paid ($5/mo) gives headroom.

---

### 3.2 Cloudflare D1 Production Setup

**Why it matters:** This is where your production data lives. Getting the D1 binding, initial data migration, and seeding right is critical — a mistake here means data loss or a broken app on launch.

**Scope:**

- Create D1 database via Wrangler CLI
- Import existing schema via Drizzle migrations
- Seed the catalog (published games) into the production D1 instance
- Configure D1 binding in `wrangler.toml`
- Test: verify all CRUD operations, generation pipeline, backstage operations work against D1
- Set up D1 backup schedule (D1 has built-in point-in-time restore — 30 days on paid plan)

---

### 3.3 Caching Layer (Workers KV)

**Why it matters:** YouTube Data API v3 has a strict 10,000 units/day quota. A single "search" costs 100 units. Caching prevents burning through this during admin onboarding sessions. KV provides fast, globally distributed key-value storage perfect for caching API responses.

**Scope:**

- Create KV namespace for YouTube API response caching
- Cache playlist search results, video metadata, duration lookups
- Set appropriate TTLs (playlist IDs: 7 days, video metadata: 30 days)
- Add cache-hit/miss logging for quota monitoring
- Consider caching Discogs responses too (less critical but reduces external dependency)

**Decision questions:**

- How aggressively should you cache? Stale YouTube data (deleted videos, changed titles) is a trade-off against quota preservation.
- Should the cache be warmable from Backstage? (i.e., admin pre-populates cache for newly published games)

---

### 3.4 Staging Environment

**Why it matters:** Deploying straight to production means your users are your testers. A staging environment lets you verify changes in an environment identical to production (same Workers runtime, same D1, same bindings) before they affect real users. This is especially important during the initial launch period when issues are most likely.

**Scope:**

- Create a separate D1 database for staging
- Configure Wrangler environments: `staging` and `production`
- Staging deploys on every push to `main`; production deploys manually or on tagged releases
- Staging uses the same env var structure but with test API keys / lower quotas

---

## Phase 4 — Observability & Operations

You can't fix what you can't see. These items give you visibility into what's happening in production.

### 4.1 Structured Logging

**Why it matters:** `console.log` in production is like shouting into the void — you can't search it, filter it, or alert on it. Structured JSON logs with request IDs let you trace a single user's request through the entire system, which is essential for debugging production issues.

**Scope:**

- Adopt a lightweight logger (pino or similar) — must work in Workers environment
- Replace all `console.error`/`console.log` with structured logger calls
- Add request correlation IDs (generated in middleware, passed through to all log calls)
- **Strip heavy debug logs** — remove `console.log` calls that output full Director scoring arrays, JSON blobs, or other verbose debugging output (these bloat server logs and memory in production)
- Log key events: session creation, generation start/complete/fail, backstage actions, rate limit hits

**Decision questions:**

- Where do logs go? Cloudflare Workers has `console.log` → Workers Logs (tail-able via `wrangler tail`). For persistence, consider Logflare, Datadog, or Cloudflare Logpush.
- How much detail in logs? Too much = noise and cost. Too little = blind in production.

---

### 4.2 Error Tracking

**Why it matters:** Users won't report most errors — they'll just leave. Error tracking (Sentry, etc.) captures every unhandled exception with full context (stack trace, request URL, user ID) so you can find and fix issues before users complain. For an open-source project, this demonstrates professionalism and reliability.

**Scope:**

- Integrate Sentry (or Toucan for Workers-native — lighter weight)
- Capture unhandled exceptions in API routes and client-side React errors
- Add error boundary component for graceful client-side failure
- Configure source maps upload for readable stack traces
- Set up alerting: email/Slack notification on new error types

**Decision questions:**

- Sentry (industry standard, generous free tier, heavier) vs. Toucan (Workers-native, lighter, less ecosystem)?
- Should client-side errors be tracked too, or just server-side?

---

### 4.3 API Quota Monitoring & Billing Caps

**Why it matters:** Anthropic API costs real money per user generation (Vibe Profiler). YouTube API quota is admin-only (onboarding) so less critical for users, but still needs monitoring. Without billing caps, a runaway script or abuse scenario can hand you a surprise bill.

**Budget:** ~$50/month for Anthropic API to start. At ~$0.05/generation, that's ~1,000 generations/month (~33/day). Adjust based on real usage data.

**Scope:**

- Track Anthropic API token usage and cost per generation (the only user-facing API cost)
- **Set hard billing cap on Anthropic API at $50/month** — if exceeded, disable Vibe Profiler and fall back to Director-only generation (still works, just without vibe-tuned scoring)
- Track YouTube API usage per day in Backstage (admin-only, used during game onboarding)
- Set YouTube API quota alerts in Google Cloud Console (warn at 80%)
- Add a Backstage dashboard widget showing current API consumption (both Anthropic and YouTube)
- Implement graceful degradation: Anthropic budget exhausted → generate without Vibe Profiler, explain to user

**Per-user generation cap:** 10 generations/day per logged-in user (configurable via a DB-backed admin setting so it can be adjusted without redeployment). Individual users can be granted higher limits via an admin override (e.g., a `daily_generation_limit` column on the users table, null = use global default).

**Decision questions:**

- When the monthly Anthropic budget is hit, should the app switch to vibe-less generation silently, or show a "reduced mode" notice?

---

### 4.4 Application Metrics

**Why it matters:** Logs tell you _what happened_ when something goes wrong. Metrics tell you _how the system is performing_ continuously — request latency, error rates, queue depth, API quota consumption over time. Without metrics, you're flying blind between incidents. You only learn about degradation when users complain, not when the p99 latency creeps from 200ms to 2s.

**What are metrics:** Metrics are numeric measurements sampled over time — counters (total requests), gauges (current active users), histograms (response time distribution). They're collected by a system like Prometheus and visualized in dashboards (Grafana). Think of logs as a diary and metrics as a heart rate monitor.

**Scope:**

- **Recommended: Cloudflare Analytics (free, built-in).** Workers has built-in analytics (request count, error rate, CPU time, latency percentiles) in the dashboard at no extra cost. For a hobby project with modest traffic, this is more than enough to start.
- **If custom metrics are needed later:** Workers Analytics Engine lets you write arbitrary data points (e.g., "generations per hour") from code and query via SQL-like API. Still Cloudflare-native, no extra infra.
- **Prometheus + Grafana is overkill for this project's scale.** Only consider if traffic grows significantly and you need advanced alerting or retention beyond what Cloudflare provides.

**Recommended metrics to track:**

- Request count and latency by route (built-in with Cloudflare)
- Error rate by route (built-in)
- Generation count per hour/day (custom)
- YouTube API units consumed per day (custom — critical for quota management)
- Anthropic API tokens/cost per day (custom)
- Active users (DAU/WAU — custom)
- D1 query latency (custom, if issues emerge)

**Decision questions:**

- Start with Cloudflare built-in analytics + Analytics Engine (simple, native, free) and add Prometheus later if needed? Or go straight to Prometheus?
- Do you want real-time dashboards, or are periodic checks sufficient for launch?
- Should metrics be visible in Backstage, or only in external dashboards?

---

### 4.5 Backup & Disaster Recovery

**Why it matters:** Cloudflare D1 has built-in point-in-time restore (30 days on paid plan), which covers most scenarios. But you should still understand your recovery story — what happens if D1 has an outage, if you accidentally run a destructive migration, or if you need to roll back a deployment?

**Scope:**

- Document D1's built-in backup capabilities and how to restore
- Set up periodic D1 exports to R2 (cold backup)
- Document rollback procedure: how to revert a bad deployment (Wrangler rollback)
- Document data recovery procedure: how to restore from D1 backup

---

## Phase 5 — Documentation & Legal

Open-source project + public-facing app = documentation matters for both contributors and users.

### 5.1 README Overhaul

**Why it matters:** The README is your project's front door. For an open-source project, it determines whether someone contributes, uses the app, or bounces. Currently the README is a minimal quickstart — it needs to tell the story of what BGMancer is, show it off, and make setup easy.

**Scope:**

- Hero section: what is BGMancer, screenshot/GIF, live link
- Features list with brief descriptions
- Architecture overview (high-level diagram)
- Local development setup (expanded from current)
- Environment variables reference (all vars, which are required vs. optional, how to obtain each)
- Deployment guide (link to separate doc)
- Contributing section (link to CONTRIBUTING.md)
- License badge

---

### 5.2 Legal Documents

**Why it matters:** Even a non-commercial hobby project needs basic legal coverage if it sets cookies or stores user data. The good news: because this isn't commercial, the requirements are minimal. A plain-language one-pager for each is sufficient — no lawyer-drafted legalese needed.

**Scope:**

- **Privacy Policy** — plain-language one-pager: what data is collected (Google account email for logged-in users, game library, session history), cookies used (auth only — strictly necessary, no tracking), third-party services (YouTube, Discogs, Anthropic), data retention (30 days inactive for logged-in, nothing stored for guests), how to request deletion (or note that inactivity auto-deletes)
- **Terms of Service** — keep it short and honest: "this is a hobby project, use at your own risk, no warranty, no guarantees of uptime"
- **LICENSE** — MIT (already decided)
- Host these as simple pages in the app (footer links)
- **No cookie consent banner needed** — all cookies are strictly necessary for authentication (exempt under ePrivacy Directive). Use `youtube-nocookie.com` for embeds to avoid YouTube setting tracking cookies.
- **No formal GDPR documentation needed** — only required for organizations with 250+ employees or high-risk data processing. Neither applies here.

---

### 5.3 YouTube API ToS Compliance

**Why it matters:** YouTube's API Terms of Service have specific requirements for any app that uses their API. Non-compliance can result in your API key being revoked — which would break all game onboarding. This is not optional; Google enforces these requirements and has automated compliance checks.

**Scope:**

- Review the [YouTube API Terms of Service](https://developers.google.com/youtube/terms/api-services-terms-of-service) and [Developer Policies](https://developers.google.com/youtube/terms/developer-policies)
- Key requirements to implement:
  - Display the YouTube logo where YouTube content is shown
  - Link to YouTube's Terms of Service from your app
  - Link to Google's Privacy Policy from your Privacy Policy
  - Do not cache YouTube API data beyond allowed durations (thumbnails, video metadata)
  - Provide a mechanism for users to revoke YouTube data access (relevant for "Sync to YouTube" OAuth flow)
  - Do not modify or obscure YouTube player branding
- Add required attributions and links to the app footer/about page
- Review caching durations for YouTube data in KV (3.3) against ToS limits

---

### 5.4 Contributing & Community Docs

**Why it matters:** Open-source projects without contribution guidelines get low-quality PRs, duplicate issues, and frustrated maintainers. Clear templates and guidelines channel community energy productively.

**Scope:**

- **CONTRIBUTING.md** — dev setup, code style, PR process, what makes a good contribution
- **GitHub Issue templates** — bug report template (steps to reproduce, expected vs. actual), feature request template
- **PR template** — checklist (tests added, lint passes, screenshots if UI change)
- Update **SECURITY.md** — expand the existing minimal file with clear vulnerability reporting instructions
- **CODE_OF_CONDUCT.md** — standard Contributor Covenant

---

### 5.5 Deployment Documentation

**Why it matters:** You need to be able to redeploy from scratch, and future contributors need to understand the infrastructure. "It works on my machine" doesn't survive a single laptop failure.

**Scope:**

- `docs/DEPLOYMENT.md` — step-by-step Cloudflare setup (D1 creation, KV namespaces, env vars, wrangler commands)
- Environment variable reference with descriptions and how to obtain each key
- Runbook: common operations (deploy, rollback, view logs, restore backup, rotate secrets)

---

## Phase 6 — Polish & Hardening

Final items that round out the production experience.

### 6.1 Graceful Degradation & User-Facing Errors

**Why it matters:** In production, things fail — APIs go down, quotas run out, LLMs return garbage, YouTube videos get taken down. Users should see helpful messages, not white screens or cryptic JSON errors. This is the difference between "the app is broken" and "YouTube is temporarily unavailable, please try again later."

**Scope:**

- Add React error boundary with user-friendly fallback UI
- Handle API route errors consistently: generic messages to clients, details in logs
- **YouTube player resilience:** when a resolved video is taken down or made unavailable, the player should gracefully skip to the next track with a brief notification — not crash or hang
- **Empty state handling:** if the Director can't assemble enough tracks to meet the target (e.g., user selected only 1 game with few tracks), show a clear explanation of _why_ and suggest actions (add more games, lower track count)
- **LLM failure handling:** if Anthropic API times out during Backstage tagging, surface a clear error in the SSE stream and leave the game in a recoverable state (not half-tagged)
- Specific degradation: YouTube API quota exhausted → clear user-facing message, Anthropic API down → explain, generation timeout → partial results with explanation
- Ensure SSE streams send proper error events on failure (not just silent close)

---

### 6.2 Production Seed Data Verification

**Why it matters:** The Director's cross-game diversity logic requires a minimum number of published games with tagged tracks to function correctly. If the production DB launches with insufficient or broken catalog data, every user's first experience will be a failure. This is a one-time verification step but it's critical for launch day.

**Scope:**

- Verify production D1 has sufficient published games for the Director to run its diversity algorithm
- Verify all published games have resolved YouTube playlist IDs and tagged tracks
- Verify no orphaned or half-onboarded games exist in the catalog
- Create a Backstage "catalog health" check that validates the above (useful ongoing, not just at launch)
- Strip any test/debug data from the production seed

---

### 6.3 Performance Optimization

**Why it matters:** Cloudflare Workers cold starts are fast (~5ms), but large bundles slow them down. Caching and bundle optimization ensure the app feels snappy even under load.

**Scope:**

- Audit and optimize bundle size (tree-shake unused dependencies)
- Ensure Next.js static generation is used where possible (catalog pages, landing)
- Review and optimize client-side data fetching patterns (avoid waterfalls)
- Consider edge caching for public API responses (`/api/games/catalog`)

---

### 6.4 Admin Operations Tooling

**Why it matters:** Cloudflare Workers are serverless — there's no SSH, no terminal, no filesystem. You can't "log in and run a command." Every ad-hoc operation you might want to perform (fix bad data, run a one-off script, inspect state) needs a planned access path. Without this, you'll be stuck when Backstage doesn't expose the exact operation you need.

**Available tools in a Workers environment:**

- `wrangler d1 execute` — run arbitrary SQL against your production D1 database from your local terminal
- `wrangler tail` — live-stream Worker logs
- Protected API endpoints — custom admin routes behind Cloudflare Access
- Local scripts using Wrangler D1 bindings — run Node.js scripts that connect to remote D1

**Scope:**

- Create a set of admin npm scripts (e.g., `npm run admin:sql`, `npm run admin:user-info`) that wrap `wrangler d1 execute` for common operations
- Add a protected `POST /api/backstage/admin/execute-sql` endpoint for emergencies (behind Cloudflare Access + additional confirmation)
- Document the "how to do X in production" runbook: common admin operations and which tool to use
- Ensure Backstage UI covers 90% of admin needs so raw SQL is rarely needed

**Decision questions:**

- Are you comfortable with `wrangler d1 execute` from your local machine as the escape hatch, or do you want a web-based SQL console in Backstage?

---

### 6.5 Health Check & Status

**Why it matters:** You need a way to know if the app is healthy from the outside. A health check endpoint lets monitoring services ping your app and alert you when it's down. A simple status page builds user trust.

**Scope:**

- Add `GET /api/health` endpoint (checks D1 connectivity, returns version/uptime)
- Consider a simple status page (can be as simple as a GitHub repo status badge or a free service like Instatus)
- Set up uptime monitoring (Cloudflare has built-in health checks, or use UptimeRobot free tier)

---

## Execution Order & Dependencies

```
Phase 0 (Foundation)
  0.1 Testing ──────┐
  0.2 CI Pipeline ──┤
                    ▼
Phase 1 (Database)
  1.1 ORM Adoption ─→ 1.2 Indexing Audit ─→ 1.3 Migration System
                                                     │
Phase 2 (Security)                                   ▼
  2.1 User Identity ─→ 2.2 JWT Hardening ─→ 2.4 Ownership Checks
  2.3 Secrets (independent)                    2.9 Rate Limiting
  2.5 Backstage Admin (after 2.1)
  2.6 Zod Validation (independent)
  2.7 Security Headers & CORS (independent)
  2.8 Dev Routes (independent)
                              │
Phase 3 (Cloudflare)          ▼
  3.1 Adapter Setup ─→ 3.2 D1 Production ─→ 3.4 Staging
  3.3 KV Caching (after 3.1)
                              │
Phase 4 (Observability)       ▼
  4.1 Structured Logging (independent)
  4.2 Error Tracking (independent)
  4.3 Quota Monitoring & Billing Caps (after 3.3)
  4.4 Application Metrics (after 3.1)
  4.5 Backup & DR (after 3.2)
                              │
Phase 5 (Documentation)       ▼
  5.1 README (independent — can start anytime)
  5.2 Legal (independent — should be ready by launch)
  5.3 YouTube API ToS (independent — must be done before launch)
  5.4 Contributing (independent)
  5.5 Deployment Docs (after Phase 3)
                              │
Phase 6 (Polish)              ▼
  6.1 Graceful Degradation (after 4.2)
  6.2 Seed Data Verification (after 3.2)
  6.3 Performance (after 3.1)
  6.4 Admin Operations Tooling (after 3.2)
  6.5 Health Check (after 3.1)
```

**Critical path:** 0.1 → 1.1 → 1.3 → 2.1 → 3.1 → 3.2 → Launch

---

## What This Plan Does NOT Cover (Intentionally)

- **Automated E2E testing (Playwright, Cypress):** Valuable but not blocking for launch. Add post-launch.
- **CDN / multi-region:** Cloudflare Workers are already globally distributed. No extra work needed.
- **WebSocket support:** The app uses SSE, which works fine on Workers.
- **Email notifications:** No use case currently. Add if feature requests demand it.
- **Analytics (Plausible, PostHog):** Nice-to-have, not blocking. Add post-launch if you want usage insights.
- **Feature flags:** Overkill for this app's complexity. Ship features directly.
- **Database encryption at rest:** D1 handles this on Cloudflare's infrastructure. Not your concern.
- **Load testing:** With Cloudflare Workers auto-scaling and D1, you'd need absurd traffic to hit limits. Monitor first, load test if you see issues.

---

## Open Questions for Scoping Sessions

These should be answered as you begin each relevant milestone:

1. **Guest-to-logged-in transition:** When a guest signs in, migrate localStorage state (game selections, config) into their account? Nice-to-have, not critical — scope during 2.1.

2. **Admin SQL console:** `wrangler d1 execute` from local terminal sufficient, or build a web-based SQL console in Backstage?

3. **Metrics stack:** Start with Cloudflare built-in analytics, or go straight to Prometheus + Grafana?

4. **Reduced mode UX:** When Anthropic monthly budget is exhausted, silent fallback to Director-only or explicit "reduced mode" notice to users?
