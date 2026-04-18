---
phase: 01-security-authorization
plan: 02
subsystem: auth-enforcement
tags: [security, audit, rate-limiting, ownership-checks]
dependency_graph:
  requires: []
  provides: [verified-auth-enforcement, correct-rate-limit-ordering]
  affects: [src/app/api/playlist/generate/route.ts]
tech_stack:
  added: []
  patterns: [rate-limit-before-turnstile]
key_files:
  created: []
  modified:
    - src/app/api/playlist/generate/route.ts
decisions:
  - Rate limit check must precede Turnstile verification on all routes that use both (cheap KV before expensive upstream call)
metrics:
  duration: 200s
  completed: 2026-04-18
  tasks: 2/2
  files_modified: 1
---

# Phase 01 Plan 02: Auth Enforcement Audit Summary

Systematic audit of all API routes against route-config declarations, verified ownership checks, validated rate limiting configuration, and spot-checked backstage handlers. Fixed one rate-limit/Turnstile ordering issue.

## Task 1: Route-Config vs Handler Auth Wrapper Audit

### Auth Wrapper Verification (18 non-backstage routes)

All routes match their declared auth levels:

| Route | Config Auth | Handler Enforcement | Status |
|-------|-------------|-------------------|--------|
| GET /api/games | Optional | withOptionalAuth | PASS |
| POST /api/games | Required | withRequiredAuth | PASS |
| PATCH /api/games | Required | withRequiredAuth | PASS |
| DELETE /api/games | Required | withRequiredAuth | PASS |
| GET /api/games/catalog | Public | raw export | PASS |
| GET /api/games/search-igdb | Public | raw export | PASS |
| POST /api/games/request | Public | raw export | PASS |
| GET /api/playlist | Optional | withOptionalAuth | PASS |
| DELETE /api/playlist | Required | withRequiredAuth | PASS |
| POST /api/playlist/generate | Optional | raw auth (getAuthSession) | PASS |
| DELETE /api/playlist/[id] | Required | withRequiredAuth | PASS |
| POST /api/playlist/[id]/reroll | Required | withRequiredAuth | PASS |
| GET /api/sessions | Optional | withOptionalAuth | PASS |
| PATCH /api/sessions/[id] | Required | withRequiredAuth | PASS |
| DELETE /api/sessions/[id] | Required | withRequiredAuth | PASS |
| POST /api/steam/sync | Required | withRequiredAuth | PASS |
| GET /api/steam/library | Required | withRequiredAuth | PASS |
| DELETE /api/steam/link | Required | withRequiredAuth | PASS |
| POST /api/sync | Required | raw auth (auth()) | PASS |

### Ownership Check Verification (Required mutation routes with dynamic IDs)

| Route | Check | Status |
|-------|-------|--------|
| DELETE /api/playlist/[id] | getTrackOwnerId + ownerId !== userId -> 403 | PASS |
| POST /api/playlist/[id]/reroll | getTrackOwnerId + ownerId !== userId -> 403 | PASS |
| PATCH /api/sessions/[id] | session.user_id !== userId -> 403 | PASS |
| DELETE /api/sessions/[id] | session.user_id !== userId -> 403 | PASS |

### Implicit Ownership (scoped by userId in queries)

| Route | Scoping | Status |
|-------|---------|--------|
| POST /api/games | tryLinkToLibrary(userId, ...) | PASS |
| PATCH /api/games | setCuration(userId, ...) | PASS |
| DELETE /api/games | remove(userId, ...) | PASS |
| DELETE /api/playlist | clearAll(userId) | PASS |

### Raw-Auth Exceptions

- POST /api/playlist/generate: calls getAuthSession(), branches authenticated (full pipeline) vs guest (Director-only). Guest path validates Turnstile + rate limit.
- POST /api/sync: calls auth(), returns 401 when session/userId/access_token missing. Needs full session for OAuth token.

## Task 2: Rate Limiting and Backstage Spot-Check

### Rate Limit Verification

| Route | Key Pattern | Max | Window | Constants Used | Status |
|-------|-------------|-----|--------|----------------|--------|
| POST /api/playlist/generate (guest) | guest:${ip} | GUEST_MAX_REQUESTS (10) | GUEST_WINDOW_MS (10min) | Yes | PASS |
| POST /api/playlist/[id]/reroll | reroll:${userId} | REROLL_MAX (30) | REROLL_WINDOW_MS (1min) | Yes | PASS |
| POST /api/sync | sync:${userId} | SYNC_MAX (5) | SYNC_WINDOW_MS (1hr) | Yes | PASS |
| GET /api/games/search-igdb | igdb-search:${ip} | IGDB_SEARCH_MAX (30) | IGDB_SEARCH_WINDOW_MS (1min) | Yes | PASS |
| POST /api/games/request | game-request:${ip} | GAME_REQUEST_MAX (5) | GAME_REQUEST_WINDOW_MS (1hr) | Yes | PASS |

All rate limit values use named constants from src/lib/constants.ts. No hardcoded numbers.

### Turnstile + Rate Limit Ordering

| Route | Order | Status |
|-------|-------|--------|
| POST /api/games/request | Rate limit FIRST, Turnstile SECOND | PASS (was already correct) |
| POST /api/playlist/generate (guest) | Rate limit FIRST, Turnstile SECOND | PASS (fixed in this plan) |

### Backstage Spot-Check

| Handler | Auth Wrapper | PII Exposure | Input Validation | Status |
|---------|-------------|--------------|------------------|--------|
| GET /api/backstage/dashboard | None (CF Access gate) | No (aggregate counts) | N/A (read-only) | PASS |
| POST /api/backstage/games | None (CF Access gate) | No | gameTitleSchema.safeParse | PASS |
| PATCH /api/backstage/tracks | None (CF Access gate) | No | Runtime typed cast + field checks | PASS |

Middleware correctly blocks backstage in production via CF_Authorization cookie check (returns 404 on failure).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed rate-limit/Turnstile ordering in guest generate path**
- **Found during:** Task 1
- **Issue:** POST /api/playlist/generate guest path called verifyTurnstileToken before checkGuestRateLimit, meaning flood requests paid for expensive upstream Turnstile siteverify calls
- **Fix:** Swapped ordering so rate limit (cheap KV lookup) runs first
- **Files modified:** src/app/api/playlist/generate/route.ts
- **Commit:** 04c6b82

## Self-Check: PASSED
