# Codebase Concerns

## Security

### Turnstile Verification Bypass

- **Location:** `src/lib/services/external/turnstile.ts`, server-side verification
- **Issue:** Turnstile verification can be bypassed if `TURNSTILE_SECRET_KEY` is not configured (falls back to success in dev mode)
- **Impact:** Guest playlist generation and game requests could bypass bot protection in misconfigured production
- **Severity:** Medium (defense-in-depth layer, not sole auth)

### Environment Variable Validation

- **Location:** `src/lib/env.ts`
- **Issue:** `NEXTAUTH_SECRET` validation only catches 2 known insecure values, not general weak secrets
- **Impact:** Weak secrets could be used in production
- **Severity:** Low (operational, not code-level)

### Cloudflare Access Token Validation

- **Location:** `src/middleware.ts`
- **Issue:** Admin route protection checks `CF_Authorization` cookie presence only, no expiry/signature verification
- **Impact:** Relies entirely on Cloudflare Access doing the validation upstream
- **Severity:** Low (defense-in-depth behind Cloudflare Access)

## Fragility

### Session Eviction Race Condition

- **Location:** `src/lib/db/repos/sessions.ts`, `Sessions.create()`
- **Issue:** Session count check and oldest-session deletion are not atomic; concurrent requests could exceed `MAX_PLAYLIST_SESSIONS`
- **Impact:** Users could temporarily have >3 sessions
- **Severity:** Low (self-correcting on next creation)

### YouTube API Response Parsing

- **Location:** `src/lib/pipeline/generation/youtube-resolve.ts`
- **Issue:** YouTube API response parsing silently fails if schema changes
- **Impact:** Track resolution could silently return empty results
- **Severity:** Medium (would break onboarding pipeline silently)

### LLM Response Parsing

- **Location:** `src/lib/pipeline/generation/vibe-profiler.ts`
- **Issue:** LLM response parsing assumes text block exists; tool use response would crash generation
- **Impact:** Generation failure if Anthropic API behavior changes
- **Severity:** Medium (runtime crash in generation path)

## Performance

### KV Rate Limiter Memory (Dev Mode)

- **Location:** `src/lib/rate-limit.ts`
- **Issue:** In-memory rate limiter in dev mode can accumulate stale entries unbounded
- **Impact:** Memory growth during long dev sessions
- **Severity:** Low (dev-only)

### Director Candidate Oversizing

- **Location:** `src/lib/pipeline/generation/director/index.ts`
- **Issue:** Director oversizes candidate sets by 15% to reduce gaps (deliberate trade-off)
- **Impact:** Slightly more processing than minimum necessary
- **Severity:** Informational (intentional design choice)

## Test Gaps

- No integration tests for YouTube quota errors
- No tests for Steam private profile detection edge cases
- KV TTL edge cases untested
- Guest generation with empty games array untested

## Scaling Considerations

### Session History

- **Location:** `src/lib/constants.ts` (`MAX_PLAYLIST_SESSIONS = 3`)
- **Issue:** Session history capped at 3 per user with FIFO eviction, no pagination
- **Impact:** Users lose older sessions; may need pagination if cap increases

### YouTube API Quota

- **Location:** `src/lib/pipeline/generation/youtube-resolve.ts`
- **Issue:** YouTube API quota is unbounded for admin onboarding operations
- **Impact:** Could exhaust daily quota during bulk onboarding

### LLM Session Naming

- **Location:** `src/lib/pipeline/generation/session-naming.ts`
- **Issue:** Session naming LLM call is not metered by `USER_DAILY_LLM_CAP` (only Vibe Profiler is capped)
- **Impact:** Naming calls are cheap but unbounded per user

## Known Limitations (Documented)

- YouTube player pause state not restored on refresh (YouTube IFrame API limitation)
- Guest data lost if localStorage is cleared (accepted design trade-off)
- `process.env.NODE_ENV` unreliable in client components with Turbopack
