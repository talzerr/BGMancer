---
phase: 01-security-authorization
plan: 01
subsystem: security
tags: [turnstile, cloudflare-access, nextauth, fail-closed, jwt-validation]
dependency_graph:
  requires: []
  provides: [hardened-turnstile, cf-access-jwt-validation, nextauth-secret-validation]
  affects: [middleware, game-request-route, guest-generation]
tech_stack:
  added: []
  patterns: [fail-closed-verification, jwt-structure-validation, minimum-secret-length]
key_files:
  created:
    - src/lib/services/auth/__tests__/cloudflare-access.test.ts (rewritten with JWT validation tests)
  modified:
    - src/lib/services/external/turnstile.ts
    - src/lib/services/external/__tests__/turnstile.test.ts
    - src/lib/services/auth/cloudflare-access.ts
    - src/lib/env.ts
decisions:
  - Turnstile uses log.error (not log.warn) for missing secret in production
  - CF Access validates JWT structure and expiry but not signature (edge handles that)
  - MIN_SECRET_LENGTH declared locally inside validation block (not module-level)
metrics:
  duration: 2m 36s
  completed: 2026-04-18T20:40:33Z
  tasks_completed: 2
  tasks_total: 2
  files_modified: 5
---

# Phase 01 Plan 01: Security Hardening Summary

Fail-closed Turnstile verification, JWT structure validation for CF Access tokens, and 32-char minimum enforcement for NEXTAUTH_SECRET.

## What Was Done

### Task 1: Turnstile Fail-Closed in Production

Hardened `verifyTurnstileToken` to return `{ success: false }` when `TURNSTILE_SECRET_KEY` is missing in production, closing a bypass where misconfigured production environments would silently skip bot verification. Dev mode bypass (`env.isDev`) preserved unchanged.

### Task 2: CF Access JWT Validation + NEXTAUTH_SECRET Length

Replaced the presence-only CF Access cookie check with structural JWT validation: requires 3 dot-separated segments, parseable JSON payload, numeric `exp` claim, and non-expired timestamp. This is defense-in-depth -- Cloudflare Access validates the signature at the edge, but garbage or expired tokens were previously accepted.

Added `MIN_SECRET_LENGTH = 32` check for `NEXTAUTH_SECRET` in non-test environments, preventing weak session signing keys with an actionable error message.

## TDD Gate Compliance

Task 1:
- RED: `9b834ab` -- test(01-01): add failing tests for Turnstile fail-closed behavior
- GREEN: `b9488a4` -- feat(01-01): harden Turnstile to fail closed in production

Task 2:
- RED: `54fd7f2` -- test(01-01): add failing tests for CF Access JWT validation
- GREEN: `988dc9c` -- feat(01-01): harden CF Access JWT validation and NEXTAUTH_SECRET length check

## Deviations from Plan

None -- plan executed exactly as written.

## Verification

- `pnpm test src/lib/services/external/__tests__/turnstile.test.ts --run` -- 8/8 pass
- `pnpm test src/lib/services/auth/__tests__/cloudflare-access.test.ts --run` -- 10/10 pass
- `pnpm test --run` -- 1095/1095 pass (zero regressions)

## Self-Check: PASSED
