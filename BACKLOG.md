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
  `POST /api/sync` and `POST /api/playlist/import` have no rate limit for authenticated
  users and could hammer YouTube API quota. Needs PM session.
- **[infra] App/backstage shared code boundary** — currently clean but informal. Needs
  explicit documentation or enforcement before the codebase grows further.
- **[backstage] Users page** — baseline view at `/backstage/users` to see who's using the
  app (activity, library stats). Expand later.

---

## Needs PM Session

Ideas with merit that need discussion and scoping before implementation. Cannot go
to a Claude Code session directly.

- **[ux] Settings panel redesign** — are pill toggles the right pattern for generation
  options? Label naming, overall settings UX.
- **[ux] Post-generation layout collapse** — how controls recede after playlist generation.
  The principle is decided (listening wins over configuration), the mechanism is not.
- **[ux] Playlist history UX** — where it lives, how it's accessed. Panel, dropdown, or
  page.
- **[player] Player bar density** — whether "Up Next" preview is needed, YouTube logo
  placement, overall player bar information architecture.
- **[player] Now-playing track indicator** — current full-width highlight is too aggressive.
  Needs redesign — subtle left-edge amber bar or small indicator.
- **[player] Revisit playlist manipulation features** — shuffle, reorder, remove, reroll.
  The arc changes what makes sense here. Some of these may conflict with the Director's
  sequencing. Needs a principled decision on which controls exist.

---

## Post-launch

Future work. No urgency, no commitment.

- **[player] Repeat modes** — off / repeat all / repeat one. Straightforward, doesn't
  conflict with the arc.
- **[player] Keyboard shortcuts** — space (play/pause), ←/→ (prev/next), m (mute),
  ? (help).
- **[ux] Shareable playlist seeds** — encode playlists as compact strings, `/share/[seed]`
  read-only view. Merges the old "playlist export" and "playlist seed share" ideas.
- **[engine] Vibe input UI** — structured selectors for energy (calm/balanced/intense) and
  activity (study, gaming, commute, exercise, relaxing). Depends on the profiler being
  perceptibly useful first.
- **[catalog] Full "request a game" flow** — VGMdb integration, backstage request queue,
  status tracking (pending → in progress → ready → rejected). Expands the pre-launch
  "can't find your game?" path into a proper system.
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
