# BGMancer

## What This Is

BGMancer is a video game soundtrack playlist generator. Users build a library of games, then generate curated playlists of background music from those games' soundtracks, played via YouTube. It supports multiple playlist modes (Journey, Chill, Mix, Rush), guest and authenticated flows, and includes a backstage admin for game onboarding and metadata curation.

## Core Value

Generate high-quality, mood-aware playlists from video game soundtracks that feel intentionally curated, not random.

## Requirements

### Validated

- Game catalog browsing and library management (guest via localStorage, authenticated via DB)
- Multi-mode playlist generation (Journey with Vibe Profiler, energy modes Chill/Mix/Rush)
- Deterministic Director assembly with arc templates and scoring telemetry
- YouTube IFrame playback with state persistence across sessions
- Per-game curation modes (lite/include/focus) affecting playlist composition
- Track reroll within energy constraints
- Anti-spoiler mode for unplayed tracks
- Steam library sync as catalog discovery aid
- Game request system (IGDB-backed, Turnstile-gated)
- Backstage admin: game onboarding (load/resolve/tag), track editor, Director telemetry (Theatre), request queue
- NextAuth v5 authentication (Google OAuth prod, Credentials dev)
- Route allowlist with four auth levels (Public/Optional/Required/Admin)
- IP and user-keyed rate limiting
- Session history with FIFO eviction (max 3)
- LLM-powered session naming
- Cloudflare Workers deployment via OpenNext

### Active

- [ ] UI visual polish and consistency audit
- [ ] Code quality review (bugs, security, dead code)
- [ ] Architecture cleanup (file organization, pattern consolidation)
- [ ] Test coverage gap identification and remediation

### Out of Scope

- New features or functionality additions
- Database schema changes
- Deployment infrastructure changes
- User-facing behavior changes (this is review/cleanup only)

## Context

The application is feature-complete for its intended scope. All major systems are built and working. The goal now is to bring the codebase to ship-ready quality through systematic review and cleanup across four dimensions: UI polish, code quality, architecture organization, and test coverage. This is a personal project with no current external users.

The codebase uses Next.js 16 App Router with Cloudflare Workers, Drizzle ORM with D1, React 19, Tailwind CSS 4, and Anthropic Claude for LLM features. Tests run via Vitest with a 100% coverage target for `src/lib/**/*.ts`.

## Constraints

- **Tech stack**: Existing stack is fixed (Next.js 16, Cloudflare Workers, Drizzle, D1)
- **No behavior changes**: Review must not alter user-facing functionality
- **Test philosophy**: 100% coverage target, no dead code, tests adapt to production code (never the reverse)

## Key Decisions

| Decision                                  | Rationale                                                 | Outcome    |
| ----------------------------------------- | --------------------------------------------------------- | ---------- |
| Review-only milestone (no new features)   | App is feature-complete, needs quality pass before launch | -- Pending |
| All four review dimensions equal priority | No single area is more urgent than others                 | -- Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):

1. Requirements invalidated? -> Move to Out of Scope with reason
2. Requirements validated? -> Move to Validated with phase reference
3. New requirements emerged? -> Add to Active
4. Decisions to log? -> Add to Key Decisions
5. "What This Is" still accurate? -> Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):

1. Full review of all sections
2. Core Value check -- still the right priority?
3. Audit Out of Scope -- reasons still valid?
4. Update Context with current state

---

_Last updated: 2026-04-18 after initialization_
