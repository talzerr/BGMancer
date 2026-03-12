# BGMancer Production Hardening — Work Document

This document is the single source of truth for hardening BGMancer for multi-user production deployment. A new agent can read this document and begin implementation immediately without any additional context.

---

## 1. Current State (Baseline)

### Deployment model

BGMancer is targeting **multi-user public deployment**. The app was originally built as a single-user local tool using a stable `LOCAL_USER_ID` constant, but must now support real isolated user accounts.

### Authentication architecture (current)

There are two auth layers that currently coexist in a broken state:

**Layer 1 — Custom anonymous session cookie** (`bgmancer-uid`)
The primary mechanism for all features. A HS256 JWT signed with `NEXTAUTH_SECRET`, minted per-user on first visit.

- Created by `createSessionJWT` in `src/lib/services/session.ts`
- Cookie options set in `src/proxy.ts`
- Verified by `getOrCreateUserId(request)` in `src/lib/services/session.ts`, which is called at the top of every API route handler

**Layer 2 — Google OAuth via NextAuth** (`src/lib/services/auth.ts`)
Optional, only used by `POST /api/sync` (sync playlist to YouTube). Stores `access_token`, `refresh_token`, `expires_at` in the NextAuth JWT. No token rotation.

### The core architectural defect: dead middleware

`src/proxy.ts` contains the `proxy()` function that mints session cookies and the Next.js `config` matcher — but **there is no `src/middleware.ts` file**. `proxy.ts` is never imported by anything. This means:

- The cookie-minting logic never runs for incoming requests
- `getOrCreateUserId` in every route falls back to the hardcoded constant `LOCAL_USER_ID` for any request that lacks a valid pre-existing cookie
- All anonymous or new users share the same identity, the same game library, the same sessions, and the same generation lock
- **Multi-user isolation is completely broken**

### All API endpoints

| Method     | Path                        | Auth state (current)                                        |
| ---------- | --------------------------- | ----------------------------------------------------------- |
| `GET/POST` | `/api/auth/[...nextauth]`   | NextAuth handler                                            |
| `GET`      | `/api/games`                | Cookie (falls back to LOCAL_USER_ID)                        |
| `POST`     | `/api/games`                | Cookie (falls back to LOCAL_USER_ID)                        |
| `PATCH`    | `/api/games?id=`            | Cookie (falls back to LOCAL_USER_ID)                        |
| `DELETE`   | `/api/games?id=`            | Cookie (falls back to LOCAL_USER_ID)                        |
| `POST`     | `/api/playlist/generate`    | Cookie — has 30s cooldown lock per userId                   |
| `GET`      | `/api/playlist`             | Cookie                                                      |
| `DELETE`   | `/api/playlist`             | Cookie                                                      |
| `PATCH`    | `/api/playlist`             | Cookie                                                      |
| `GET`      | `/api/playlist/[id]`        | **None**                                                    |
| `DELETE`   | `/api/playlist/[id]`        | Cookie — **no ownership check**                             |
| `POST`     | `/api/playlist/[id]/reroll` | Cookie                                                      |
| `POST`     | `/api/playlist/import`      | Cookie                                                      |
| `POST`     | `/api/playlist/search`      | Cookie                                                      |
| `GET`      | `/api/sessions`             | Cookie                                                      |
| `PATCH`    | `/api/sessions/[id]`        | Cookie — **no ownership check**                             |
| `DELETE`   | `/api/sessions/[id]`        | Cookie — **no ownership check**                             |
| `POST`     | `/api/sync`                 | Google OAuth required                                       |
| `GET`      | `/api/yt-cache`             | Cookie                                                      |
| `PUT`      | `/api/yt-cache`             | Cookie                                                      |
| `DELETE`   | `/api/yt-cache?game_id=`    | Cookie                                                      |
| `POST`     | `/api/user/tier`            | Cookie — **no guard, any user can self-upgrade to Maestro** |
| `GET`      | `/api/steam/search?q=`      | None                                                        |
| `GET`      | `/api/steam/games?input=`   | None                                                        |
| `POST`     | `/api/steam/import`         | Cookie                                                      |
| `GET`      | `/api/dev/yt-playlists`     | **None — no auth, no env guard**                            |
| `GET`      | `/api/seed/yt-playlists`    | **None — no auth, no env guard**                            |

### Security gaps summary

| Severity    | Gap                                                                 | Location                                                                   |
| ----------- | ------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| **BLOCKER** | Dead middleware — all users share LOCAL_USER_ID                     | `src/proxy.ts` never imported; no `src/middleware.ts`                      |
| **BLOCKER** | JWT tokens have no expiration                                       | `src/lib/services/session.ts:13` — no `.setExpirationTime()`               |
| **HIGH**    | Hardcoded fallback JWT secret `"dev-fallback-secret-change-me"`     | `src/proxy.ts:9`, `src/lib/services/session.ts:9`                          |
| **HIGH**    | Session cookie missing `secure: true`                               | `src/proxy.ts:39-44`                                                       |
| **HIGH**    | Docker CMD regenerates `NEXTAUTH_SECRET` on every restart           | `Dockerfile` CMD line                                                      |
| **HIGH**    | No ownership checks on session/playlist delete routes               | `src/app/api/sessions/[id]/route.ts`, `src/app/api/playlist/[id]/route.ts` |
| **HIGH**    | `/api/user/tier` unguarded — any user can self-upgrade to paid tier | `src/app/api/user/tier/route.ts`                                           |
| **HIGH**    | Dev/seed routes exposed with no auth                                | `src/app/api/dev/`, `src/app/api/seed/`                                    |
| **HIGH**    | No HTTP rate limiting on any route                                  | No `src/middleware.ts`, no rate-limit library                              |
| **HIGH**    | No security headers (HSTS, CSP, X-Frame-Options, etc.)              | `next.config.ts`                                                           |
| **MEDIUM**  | No schema validation library — manual, inconsistent per route       | All routes in `src/app/api/`                                               |
| **MEDIUM**  | No structured logging or audit trail                                | All routes use `console.error`                                             |
| **MEDIUM**  | No CI pipeline                                                      | No `.github/workflows/`                                                    |
| **MEDIUM**  | No off-site backup strategy                                         | `npm run db:backup` exists but undocumented                                |
| **LOW**     | OAuth refresh token stored in NextAuth JWT with no rotation         | `src/lib/services/auth.ts:12-14`                                           |
| **LOW**     | `next-auth@5.0.0-beta.30` in security-critical path                 | `package.json`                                                             |
| **LOW**     | SQLite DB not encrypted at rest                                     | `src/lib/db/index.ts`                                                      |

### Files to understand before starting

| File                                      | Role                                                                    |
| ----------------------------------------- | ----------------------------------------------------------------------- |
| `src/proxy.ts`                            | Dead session-minting middleware — needs to become `src/middleware.ts`   |
| `src/lib/services/session.ts`             | `createSessionJWT`, `getOrCreateUserId` — JWT creation and verification |
| `src/lib/services/auth.ts`                | NextAuth config (Google OAuth for YouTube sync)                         |
| `src/app/api/auth/[...nextauth]/route.ts` | 3-line NextAuth route handler                                           |
| `src/lib/db/index.ts`                     | DB singleton, `LOCAL_USER_ID` constant, schema init                     |
| `src/lib/db/repos/_shared.ts`             | Shared SQL constants and `stmt()` helper                                |
| `src/lib/constants.ts`                    | All app constants incl. `GENERATION_COOLDOWN_MS`                        |
| `src/types/index.ts`                      | All shared types incl. `UserTier`, `AppConfig`                          |
| `next.config.ts`                          | Next.js config — needs `headers()` added                                |
| `Dockerfile`                              | Multi-stage Docker build — CMD has secret-generation issue              |
| `docker-compose.yml`                      | Production compose setup                                                |

### What is working well (do not break)

- **SQL injection: not a risk.** All DB access uses `better-sqlite3` prepared statements with bound parameters. The `stmt()` helper in `src/lib/db/repos/_shared.ts` caches prepared statements and never interpolates user input into SQL.
- **Error details not leaked to clients.** Routes return generic messages while logging details to `console.error`.
- **Dependabot configured** for weekly npm scans (`.github/dependabot.yml`).
- **Generation lock** in `POST /api/playlist/generate` — 30s cooldown per userId using SQLite transactions in `Users.tryAcquireGenerationLock`. Once user isolation is fixed this will work correctly per real user.
- **`.gitignore`** properly excludes `.env*.local` and `*.db` files.

---

## 2. Target State

After all milestones are complete:

- Every HTTP request passes through `src/middleware.ts`, which mints or verifies the `bgmancer-uid` cookie. Missing or invalid cookies on API routes return 401. The `LOCAL_USER_ID` fallback is **removed from all API routes**.
- Session JWTs expire after 30 days and are refreshed on activity.
- `NEXTAUTH_SECRET` missing at startup crashes the app immediately with a clear error message. The Docker image requires it to be injected as an environment secret.
- The `bgmancer-uid` cookie has `secure: true`, `httpOnly: true`, `sameSite: strict`.
- All mutating routes (`DELETE/PATCH sessions`, `DELETE playlist track`) verify that the resource belongs to the requesting user before operating.
- `/api/user/tier` is restricted to a configurable admin flag or removed — tier selection is server-side only.
- `/api/dev/*` and `/api/seed/*` routes are removed or gated behind `NODE_ENV !== 'production'`.
- Rate limiting applied at the middleware level: 60 req/min per user on general routes, 2 req/min on `/api/playlist/generate`, 10 req/min on Steam/import routes.
- `next.config.ts` exports a `headers()` function with HSTS, CSP, X-Content-Type-Options, X-Frame-Options, Referrer-Policy.
- All API routes validate request bodies with Zod schemas — no manual type-checking.
- Structured JSON logs with a request correlation ID. An `audit_log` table records auth, tier-change, and library-mutation events.
- CI runs `npm run build`, `npm run lint`, and `npm audit` on every push.

---

## 3. Milestones

### Dependencies

```
M0 (user isolation) → M1 (JWT expiry) → M3 (ownership checks)
M0 → M4 (rate limiting)
M2 (secrets) — independent
M5 (unguarded routes) — independent
M6 (security headers) — independent
M7 (Zod validation) — independent, after M0 (needs real request body shapes)
M8 (structured logging) — independent
M9 (CI) — independent
M10 (backup docs) — independent
```

Execute in order: **M0, M1, M2, M3, M4, M5, M6 — then M7, M8, M9, M10 in any order**

---

### M0 — User Isolation (Wire the Middleware)

**Severity: BLOCKER**

Create `src/middleware.ts` by extracting and fixing the logic from `src/proxy.ts`. After this milestone, every API request has a real unique user identity and `LOCAL_USER_ID` is no longer used as a fallback.

**What to do:**

1. Create `src/middleware.ts` that exports:
   - A `middleware` function that runs `getOrCreateUserId` logic: reads the `bgmancer-uid` cookie, verifies it, and if absent/invalid, mints a new one and sets it in the response headers.
   - A `config` object with `matcher: ['/((?!_next/static|_next/image|favicon.ico).*)']` (or import from `src/proxy.ts`).
2. The middleware must handle the case where it's running on an API route (`/api/*`) differently from page routes:
   - **Page routes**: always mint a new cookie if missing (current proxy.ts behavior).
   - **API routes that require auth**: if cookie is missing or invalid, return `Response.json({ error: 'Unauthorized' }, { status: 401 })`. Do not auto-mint.
   - **Unauthenticated API routes** (`/api/steam/search`, `/api/steam/games`, `GET /api/playlist/[id]`): pass through.
3. Remove the `LOCAL_USER_ID` fallback from `getOrCreateUserId` in `src/lib/services/session.ts`. It should throw or return null on invalid/missing cookie so routes can handle it properly.
4. Update all API routes that call `getOrCreateUserId` to handle the null/throw case and return 401.
5. Delete `src/proxy.ts` once the middleware is wired up.

**API routes that are explicitly unauthenticated (do not add auth check):**

- `GET /api/steam/search`
- `GET /api/steam/games`
- `GET /api/playlist/[id]` (read-only public track lookup — keep as-is)
- `GET/POST /api/auth/[...nextauth]` (NextAuth handler)

**Constants to keep:**

- `LOCAL_USER_ID` in `src/lib/db/index.ts` — still needed for the seed/schema functions (`seedDefaultUser`). Do not remove from db/index.ts. Just remove it as a fallback in session.ts.

---

### M1 — JWT Expiration & Cookie Hardening

**Severity: BLOCKER → HIGH**

**Depends on: M0**

Fix the session JWT to expire, and harden the cookie flags.

**What to do:**

1. In `createSessionJWT` (`src/lib/services/session.ts:13`), add `.setExpirationTime('30d')` before `.sign()`.
2. In `getOrCreateUserId`, if JWT verification throws `JWTExpired`, treat it the same as missing cookie: mint a new one (for page routes via middleware) or return 401 (for API routes).
3. In the middleware (M0), when minting a new cookie set these options:
   ```
   httpOnly: true
   secure: true          // add this — was missing
   sameSite: 'strict'    // upgrade from 'lax'
   path: '/'
   maxAge: 60 * 60 * 24 * 30  // 30 days
   ```
4. Implement "sliding expiry": when a valid JWT is verified but has less than 7 days remaining, the middleware re-mints and re-sets the cookie transparently.

---

### M2 — Secrets Hardening

**Severity: HIGH — independent of M0/M1**

Eliminate the hardcoded fallback secret and fix the Docker startup behavior.

**What to do:**

1. In both `src/proxy.ts` (or `src/middleware.ts` after M0) and `src/lib/services/session.ts`, replace:
   ```typescript
   const s = process.env.NEXTAUTH_SECRET ?? "dev-fallback-secret-change-me";
   ```
   with:
   ```typescript
   const s = process.env.NEXTAUTH_SECRET;
   if (!s) throw new Error("NEXTAUTH_SECRET environment variable is required");
   ```
2. In `Dockerfile`, change the CMD from:
   ```sh
   CMD ["sh", "-c", "export NEXTAUTH_SECRET=${NEXTAUTH_SECRET:-$(openssl rand -base64 32)} && npm start"]
   ```
   to:
   ```sh
   CMD ["node", "server.js"]
   ```
   (or equivalent `npm start` without the random secret generation). The secret must be injected via `docker-compose.yml` as an environment variable from `.env.docker` — which already uses `env_file: .env.docker`. Document in README that `NEXTAUTH_SECRET` is required in `.env.docker`.
3. Add a startup validation function called at the top of `src/lib/db/index.ts` (runs server-side only) that throws on missing required env vars: `NEXTAUTH_SECRET`, `YOUTUBE_API_KEY`.

---

### M3 — Ownership Checks on Mutation Routes

**Severity: HIGH**

**Depends on: M0** (need real userId)

Three routes operate on resources without verifying ownership:

**`DELETE /api/playlist/[id]/route.ts`**

- The `[id]` param is a track's video ID (or playlist entry ID — confirm from the route).
- Before deleting, query the DB to verify the track belongs to the requesting user's active session. If not, return 403.

**`PATCH /api/sessions/[id]/route.ts`**

- Before updating session name, verify `Sessions.get(id)` exists and `session.userId === requestingUserId`. Return 403 if not.

**`DELETE /api/sessions/[id]/route.ts`**

- Same ownership check as PATCH. Verify session.userId matches before deletion.

---

### M4 — Rate Limiting

**Severity: HIGH**

**Depends on: M0** (rate limiting keyed on real userId)

Add HTTP-level rate limiting via an in-memory store (acceptable for single-instance deployment).

**Recommended approach:** Use `lru-cache` (already in the project or easily added) as the backing store for a sliding window counter. This avoids adding a Redis dependency.

**Rate limit tiers to implement:**

| Route pattern                 | Limit        | Window                    |
| ----------------------------- | ------------ | ------------------------- |
| `POST /api/playlist/generate` | 3 requests   | per 10 minutes per userId |
| `POST /api/steam/import`      | 5 requests   | per minute per userId     |
| `POST /api/playlist/import`   | 10 requests  | per minute per userId     |
| `POST /api/games` (add game)  | 30 requests  | per minute per userId     |
| All other `/api/*` routes     | 120 requests | per minute per userId     |

**Where to implement:** In `src/middleware.ts` (M0), after the auth check, before passing through. The middleware has access to `userId` from the verified cookie.

**Response on rate limit exceeded:** `429 Too Many Requests` with header `Retry-After: <seconds>` and JSON body `{ "error": "Rate limit exceeded" }`.

**Note:** The existing `Users.tryAcquireGenerationLock` (30s per-user cooldown in SQLite) is a separate application-level guard that remains in place alongside this HTTP-level limiting.

---

### M5 — Remove/Guard Unprotected Routes

**Severity: HIGH — independent**

Three routes are either dev-only or should not be publicly accessible:

1. **`GET /api/dev/yt-playlists`** — Remove this route entirely (it's a dev inspection tool). If needed for debugging, add a check: `if (process.env.NODE_ENV === 'production') return NextResponse.json({ error: 'Not found' }, { status: 404 })`.

2. **`GET /api/seed/yt-playlists`** — Same treatment. This is a DB seed utility that should never be callable in production. Remove or production-gate.

3. **`POST /api/user/tier`** — This route allows any authenticated user to toggle their own tier between `Bard` and `Maestro`. In a multi-user deployment, allowing users to self-upgrade to Maestro (Claude API) is a cost risk. Options:
   - **Option A (simplest):** Remove the route entirely. Make tier selection admin-only via a config toggle.
   - **Option B:** Restrict it — only allow the user whose `userId === ADMIN_USER_ID` (a new env var) to set Maestro tier. All other users are always Bard.
   - Decide which option and implement accordingly.

---

### M6 — Security Headers

**Severity: HIGH — independent**

Add HTTP security headers to `next.config.ts`.

**What to add:**

```typescript
// In next.config.ts, add a headers() export:
async headers() {
  return [
    {
      source: '/(.*)',
      headers: [
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        {
          key: 'Strict-Transport-Security',
          value: 'max-age=63072000; includeSubDomains; preload',
        },
        {
          key: 'Content-Security-Policy',
          value: [
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline' 'unsafe-eval'",  // Next.js requires unsafe-eval in dev; tighten in prod
            "style-src 'self' 'unsafe-inline'",
            "img-src 'self' data: https://i.ytimg.com https://img.youtube.com",
            "media-src 'self' https://www.youtube.com",
            "frame-src https://www.youtube.com",
            "connect-src 'self'",
            "font-src 'self'",
          ].join('; '),
        },
      ],
    },
  ];
},
```

**Important:** Test the CSP carefully — if YouTube embeds or any external resources stop loading, adjust `img-src`, `media-src`, or `frame-src`. The CSP above is a starting point based on the app's known external resources (`i.ytimg.com` images, YouTube embeds).

---

### M7 — Zod Input Validation

**Severity: MEDIUM — independent (but do after M0)**

Replace ad-hoc manual validation in API routes with Zod schemas.

**Install:** `npm install zod` (if not already present — check `package.json` first).

**Routes that need schema validation added (prioritized by risk):**

1. `POST /api/playlist/generate` — `target_track_count` needs a `z.number().int().min(1).max(50)` cap; the current `Number(body.target_track_count)` accepts any value
2. `PATCH /api/sessions/[id]` — session name needs `z.string().min(1).max(100)` (constant `SESSION_NAME_MAX_LENGTH` exists but is not enforced server-side)
3. `POST /api/games` — already has manual length checks; migrate to Zod for consistency
4. `POST /api/steam/import` — migrate manual type checks to Zod
5. `PUT /api/yt-cache` — add `z.string().uuid()` for `game_id`

**Pattern to use in each route:**

```typescript
const schema = z.object({ ... });
const parsed = schema.safeParse(await request.json());
if (!parsed.success) {
  return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
}
const { fieldName } = parsed.data;
```

---

### M8 — Structured Logging & Audit Trail

**Severity: MEDIUM — independent**

**Part A — Structured logging**

Replace all `console.error`/`console.log` with a structured logger that emits JSON lines in production. Recommended: `pino` (lightweight, Next.js-compatible).

```typescript
// src/lib/logger.ts
import pino from "pino";
export const logger = pino({ level: process.env.LOG_LEVEL ?? "info" });
```

Replace `console.error("[GET /api/games]", err)` patterns across all 25+ files with `logger.error({ err, route: 'GET /api/games' }, 'Failed to fetch games')`.

**Part B — Audit log table**

Add an `audit_log` table to the schema in `src/lib/db/index.ts`:

```sql
CREATE TABLE IF NOT EXISTS audit_log (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL,
  event      TEXT NOT NULL,  -- 'session_created', 'tier_changed', 'game_added', 'game_deleted', 'steam_import', 'generation_started'
  metadata   TEXT,           -- JSON blob
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)
```

Log these events:

- `session_created` — new cookie minted (in middleware)
- `tier_changed` — `/api/user/tier` call with old and new tier
- `game_added` / `game_deleted` — in games route
- `steam_import` — count of imported games
- `generation_started` / `generation_completed` — in pipeline

Add a `AuditLog.insert(userId, event, metadata)` method to `src/lib/db/repo.ts`.

---

### M9 — CI Pipeline

**Severity: MEDIUM — independent**

Create `.github/workflows/ci.yml`:

```yaml
name: CI
on: [push, pull_request]
jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: "npm"
      - run: npm ci
      - run: npm run lint
      - run: npm run format:check
      - run: npm audit --audit-level=high
      - run: npm run build
        env:
          NEXTAUTH_SECRET: ci-placeholder-secret
          YOUTUBE_API_KEY: ci-placeholder-key
```

Note: `npm run build` requires env vars that would normally fail startup validation (M2). Pass CI-safe placeholder values via workflow env rather than skipping validation.

---

### M10 — Backup & Rollback Strategy

**Severity: MEDIUM — independent**

**Document and automate off-site backups:**

1. The existing `npm run db:backup` script creates a snapshot under `/snapshots/`. This is on-host only — useless against ransomware or disk failure.
2. Add a daily cron (or Docker cron container) that rsync/rclone pushes the snapshot to an off-site destination (S3, Backblaze B2, etc.). Document the setup in a `docs/BACKUP.md` or README section.
3. Document the rollback procedure:
   - **Code rollback**: keep the last 2 Docker image tags in your registry; `docker-compose` pull + restart to roll back.
   - **DB rollback**: `npm run db:restore` from a named snapshot file; document which snapshot corresponds to which release.
4. Tag Docker images with git SHA on build. Update `Dockerfile` or compose to use tagged images rather than `latest`.

---

## 4. Completion Checklist

Before considering the app production-ready, verify each item:

- [ ] M0: `src/middleware.ts` exists and runs on all API routes; `src/proxy.ts` deleted; no `LOCAL_USER_ID` fallback in session.ts
- [ ] M0: New users hitting the app get a fresh UUID cookie; two browser sessions get different identities
- [ ] M1: Session JWT has a 30d expiry; expired tokens return 401; cookie has `secure: true`
- [ ] M2: Starting the app without `NEXTAUTH_SECRET` crashes with a clear error; Docker CMD has no `openssl rand` fallback
- [ ] M3: Attempting to delete another user's session returns 403; attempting to delete another user's playlist track returns 403
- [ ] M4: Calling `POST /api/playlist/generate` more than 3 times in 10 minutes returns 429
- [ ] M5: `GET /api/dev/yt-playlists` returns 404 in production; `POST /api/user/tier` is restricted or removed
- [ ] M6: Response headers include `Strict-Transport-Security` and `Content-Security-Policy`; YouTube thumbnails still load
- [ ] M7: Passing `target_track_count: 99999` to generate returns 400; session rename with 200-char name returns 400
- [ ] M8: App logs are JSON in production; `audit_log` table exists and records game adds and generation events
- [ ] M9: CI passes on a clean branch with `npm run build`, `npm run lint`, `npm audit`
- [ ] M10: A backup script ships the DB snapshot off-host; rollback procedure is documented
