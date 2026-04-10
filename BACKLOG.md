# BACKLOG.md — BGMancer

Work items and ideas. Organized by readiness, not priority within sections.
When picking up a task, check its status: some need a PM session before a
Claude Code session can implement them.

---

## Bugs

No open bugs.

---

## Pre-launch

Items that must be done before removing Zero Trust and going public.

- **[infra] Verify admin route protection** — `/api/steam/*` routes are `AuthLevel.Admin`
  but not under the `/backstage*` path. Confirm these return 404 to unauthenticated users
  after the Cloudflare Access policy is narrowed to backstage only.
- **[infra] Rate limiting baseline** — no unified rate limiting strategy exists. Need at
  minimum a clear alignment on approach before opening to the public. Known gap:
  `POST /api/sync` has no rate limit for authenticated users and could hammer YouTube
  API quota. Needs PM session.
- **[infra] App/backstage shared code boundary** — currently clean but informal. Needs
  explicit documentation or enforcement before the codebase grows further.
- **[infra] Data retention policy** — needs PM session. What happens to inactive user
  data? No automatic cleanup exists. Decision needed before finalizing legal pages.
  Sequence: this decision first, then legal page review.
- **[backstage] Users page** — baseline view at `/backstage/users` to see who's using the
  app (activity, library stats). Expand later.
- **[docs] README overhaul** — hero section, features, architecture overview, setup
  guide, env var reference. Must be done before the repo is public-facing.
- **[legal] YouTube API ToS compliance audit** — full review from zero: logo display,
  ToS links, privacy policy links to Google, caching durations, player branding,
  revocation mechanism for Sync-to-YouTube OAuth. Google enforces these.
- **[legal] Review privacy policy and ToS pages** — pages exist but need review against
  current app behavior (Google OAuth data, YouTube embeds, Anthropic usage, cookie
  policy). Sequence after the data retention decision.
- **[polish] Graceful degradation audit** — YouTube player resilience when a video is
  unavailable (skip gracefully, don't hang), React error boundaries, empty states when
  the Director can't fill enough tracks. Audit current state, fix gaps.
- **[polish] Production seed data verification** — one-time check before launch: all
  published games have tagged tracks and resolved videos, no orphaned or half-onboarded
  games in the catalog.

---

## Needs PM Session

Ideas with merit that need discussion and scoping before implementation. Cannot go
to a Claude Code session directly.

- **[player] Revisit playlist manipulation features** — shuffle, reorder, remove, reroll.
  The arc changes what makes sense here. Some of these may conflict with the Director's
  sequencing. Needs a principled decision on which controls exist.

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
- **[player] Repeat modes** — off / repeat all / repeat one. Straightforward, doesn't
  conflict with the arc.
- **[player] Keyboard shortcuts** — space (play/pause), ←/→ (prev/next), m (mute),
  ? (help).
- **[ux] Guest-to-logged-in state migration** — needs PM session. When a guest signs
  in, should localStorage state (game library, config) transfer to their account?
- **[ux] Shareable playlist seeds** — encode playlists as compact strings, `/share/[seed]`
  read-only view. Merges the old "playlist export" and "playlist seed share" ideas.
- **[engine] Vibe input UI** — structured selectors for energy (calm/balanced/intense) and
  activity (study, gaming, commute, exercise, relaxing). Depends on the profiler being
  perceptibly useful first.
- **[catalog] Full "request a game" flow** — expand the pre-launch IGDB-based request
  system into a proper pipeline: status tracking (pending → in progress → ready →
  rejected), user notifications, automatic onboarding from IGDB data. The lean version
  is already live.
- **[ux] Dynamic game art background** — hero image wash as ambient layer. Heavily blurred
  and desaturated, 3–6% opacity, crossfade on game transitions. Approved in principle,
  implementation deferred.
- **[ux] Track rating** — thumbs up/down while playing. Vague idea for future
  personalization. Low priority, may not be relevant.
- **[ux] Track flagging by users** — let users flag problematic tracks (bad YouTube match,
  wrong metadata). Appears in backstage for admin review. Replaces the old track
  blacklist idea.
- **[ux] URL state strategy** — shareable playlist links, deep-linkable filter states.
  Becomes relevant if sharing or link-based navigation becomes a feature.
- **[backstage] User/Admin view toggle** — toggle between user and admin experience in
  the main app. Surfaces admin affordances (backstage quick-open on tracks, dev overlays)
  without separate accounts. Not relevant until admin features exist in the main app.
- **[backstage] Quick-open from playlist track** — admin-only affordance on playlist
  track cards to navigate directly to that track's game in backstage. Depends on
  admin view toggle.
- **[backstage] Visual guidelines doc** — lightweight guardrails for backstage UI.
  Not a full design system — just a short doc that establishes backstage as visually
  separate from the main app (no amber, no warm neutrals, no design system bleed).
  Baseline: shadcn defaults, neutral palette, functional over polished. Keeps future
  backstage sessions consistent without over-engineering admin tooling.
- **[ux] Natural auth incentive** — explore non-intrusive ways to communicate that
  signing in improves the experience (better playlist shaping, session history,
  persistent library, sync to YouTube) without implying the guest experience is
  inferior or using "AI-powered" language. Must feel discovered, not sold.

---

## Mobile

Not a current priority. Grouped separately to keep the main backlog focused.

- **Responsive layout** — phone/tablet support for main page and catalog.
- **Collapsible library drawer (mobile)** — bottom sheet pattern, collapsed by default.
- **PWA install** — web app manifest + service worker for home screen install.
