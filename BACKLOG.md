# BACKLOG.md — BGMancer

Work items and ideas. Organized by readiness, not priority within sections.
When picking up a task, check its status: some need a PM session before a
Claude Code session can implement them.

---

## Bugs

- **[backstage] Unresolved tracks can't be re-resolved** — when no videos resolve
  (including cases where tracks were outside the 80-track cap), there's no way to
  trigger re-resolution from the backstage UI.
- **[backstage] Track rename resets resolved state** — changing a track's name clears
  its resolved YouTube video, requiring re-resolution.

---

## Pre-launch

Items that must be done before removing Zero Trust and going public.

- **[feature] YouTube sync implementation** — sync-to-YouTube is currently a
  placeholder, not implemented. Full implementation needed before launch.
- **[infra] Verify admin route protection** — `/api/steam/*` routes are
  `AuthLevel.Admin` but not under the `/backstage*` path. Confirm these return 404
  to unauthenticated users after Cloudflare Access policy is narrowed.
- **[infra] Rate limiting baseline** — no unified rate limiting strategy exists.
  Known gap: `POST /api/sync` has no rate limit for authenticated users and could
  hammer YouTube API quota. Needs PM session.
- **[infra] App/backstage shared code boundary** — currently clean but informal.
  Needs explicit documentation or enforcement before the codebase grows further.
- **[infra] Data retention policy** — needs PM session. What happens to inactive
  user data? No automatic cleanup exists. Decision needed before finalizing legal
  pages. Sequence: this decision first, then legal page review.
- **[backstage] Users page** — baseline view at `/backstage/users` to see who's
  using the app (activity, library stats). Expand later.
- **[docs] README overhaul** — hero section, features, architecture overview, setup
  guide, env var reference. Must be done before the repo is public-facing.
- **[legal] YouTube API ToS compliance audit** — full review from zero: logo display,
  ToS links, privacy policy links to Google, caching durations, player branding,
  revocation mechanism for Sync-to-YouTube OAuth. Google enforces these.
- **[legal] Review privacy policy and ToS pages** — pages exist but need review
  against current app behavior (Google OAuth data, YouTube embeds, Anthropic usage,
  cookie policy). Sequence after the data retention decision.
- **[polish] Graceful degradation audit** — YouTube player resilience when a video is
  unavailable (skip gracefully, don't hang), React error boundaries, empty states
  when the Director can't fill enough tracks. Audit current state, fix gaps.
- **[polish] Production seed data verification** — one-time check before launch: all
  published games have tagged tracks and resolved videos, no orphaned or
  half-onboarded games in the catalog.

---

## Needs PM Session

Ideas with merit that need discussion and scoping before implementation. Cannot go
to a Claude Code session directly.

- **[player] Revisit playlist manipulation features** — shuffle, reorder, remove,
  reroll. The arc changes what makes sense here. Some of these may conflict with the
  Director's sequencing. Needs a principled decision on which controls exist.

---

## Post-launch

Future work. No urgency, no commitment.

- **[infra] Observability baseline** — structured logging with correlation IDs, error
  tracking (Sentry or equivalent), application metrics, API quota monitoring with
  Anthropic billing alerts. Currently relying on Cloudflare built-in analytics and
  Anthropic dashboard without alerts.
- **[infra] Backup & DR documentation** — document D1 restore procedures, periodic
  exports to R2, rollback runbook.
- **[infra] Performance optimization** — bundle audit, static generation, caching for
  public API responses. No known issues currently.
- **[infra] Admin operations tooling** — admin scripts wrapping `wrangler d1 execute`
  for common operations, production runbook. Currently using raw wrangler commands.
- **[infra] Health check endpoint** — `GET /api/health` with D1 connectivity check,
  version info.
- **[docs] Contributing & community docs** — CONTRIBUTING.md, GitHub issue templates,
  PR template, CODE_OF_CONDUCT.md.
- **[docs] Deployment documentation** — step-by-step Cloudflare setup, env var
  reference, operations runbook.
- **[design] Design system addendum** — minor. The release design session produced
  updates to DESIGN_SYSTEM.md (game color tints, arc spacing, launchpad welcome,
  player strip, overlay treatment, catalog buttons). Needs PM review before merging.
- **[design] Now-playing track indicator** — minor. Current implementation needs
  review against design system spec (left-edge amber bar + equalizer icon).
- **[player] Repeat modes** — off / repeat all / repeat one. Straightforward, doesn't
  conflict with the arc.
- **[player] Keyboard shortcuts** — space (play/pause), ←/→ (prev/next), m (mute),
  ? (help).
- **[ux] Guest-to-logged-in state migration** — needs PM session. When a guest signs
  in, should localStorage state (game library, config) transfer to their account?
- **[ux] Shareable playlist seeds** — encode playlists as compact strings,
  `/share/[seed]` read-only view.
- **[ux] Mode discoverability** — if telemetry shows low engagement with energy modes,
  PM decision needed on whether to promote the mode selector above the Advanced fold.
- **[ux] Mode visual theming** — design pass to give each mode a distinct color accent
  or icon. Currently text-only labels everywhere.
- **[engine] Director test playground** — standalone runnable script that lets people
  clone the repo and see the scoring pipeline step by step with sample tracks.
  Companion to DIRECTOR.md for open-source education.
- **[catalog] Full "request a game" flow** — expand the pre-launch IGDB-based request
  system into a proper pipeline: status tracking, user notifications, automatic
  onboarding. The lean version is already live.
- **[ux] Dynamic game art background** — hero image wash as ambient layer. Heavily
  blurred and desaturated, 3–6% opacity, crossfade on game transitions. Approved in
  principle, implementation deferred.
- **[ux] Track rating** — thumbs up/down while playing. Vague idea for future
  personalization. Low priority, may not be relevant.
- **[ux] Track flagging by users** — let users flag problematic tracks (bad YouTube
  match, wrong metadata). Appears in backstage for admin review.
- **[ux] URL state strategy** — shareable playlist links, deep-linkable filter states.
- **[backstage] User/Admin view toggle** — toggle between user and admin experience.
- **[backstage] Quick-open from playlist track** — admin-only affordance to navigate
  directly to that track's game in backstage.
- **[backstage] Visual guidelines doc** — lightweight guardrails for backstage UI
  establishing visual separation from the main app.
- **[backstage] Bug fixes** — unresolved track re-resolution and track rename state
  reset issues to be addressed post-launch.
- **[backstage] Theatre data export** — one-click export of full Theatre telemetry
  for a session (track decisions, scores, arc phases, budgets, rubric) to CSV or
  JSON. For feeding to LLM or scripts for analysis.
- **[backstage] Theatre flat-phase rendering** — more compact single-row visualization
  for Steady-phase energy-mode playlists in Theatre view.
- **[ux] Natural auth incentive** — non-intrusive sign-in encouragement after first
  completed playlist generation (DEC-018). Needs design pass for trigger, placement,
  and copy.
- **[schema] Game accent color column** — pre-computed `accent_color` on `games`
  table (DEC-019). Bundle into next natural schema migration.

---

## Mobile

Not a current priority. Grouped separately to keep the main backlog focused.

- **Responsive layout** — phone/tablet support for main page and catalog.
- **Collapsible library drawer (mobile)** — bottom sheet pattern, collapsed by default.
- **PWA install** — web app manifest + service worker for home screen install.
