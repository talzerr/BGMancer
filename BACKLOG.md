# What's Coming

## Player

- **Repeat modes** — off / repeat all / repeat one.
- **Keyboard shortcuts** — Space (play/pause), ←/→ (prev/next), `m` (mute), `?` (help).
- **State retention** — remember playback position on reload; resume from that track.

## Playlist & UX

- **Track rating** — thumbs up / down while playing; seed data for future personalization.
- **Track blacklist** — permanently exclude a video from future generations.
- **Better session names** — optional LLM side-call to produce evocative names (e.g. "Soulsborne Descent") from track energy and roles.
- **Playlist preview before commit** — review assembled tracks before saving; allow manual swaps/removals.
- **Playlist export** — export as plain text or CSV.
- **Mobile layout** — responsive design for phone/tablet.
- **PWA install** — web app manifest + service worker for home screen install.

## Library & Integration

- **Steam game list import** — let users import their Steam game lists, resolved against the existing game catalog in the database, to build their game library.
- **YouTube OAuth login for playlist sync** — let users log in with YouTube privileges so curated playlists are created directly in their YouTube account.

## Walled Garden (Curated Library Model)

- **"Request a Game" flow** — a request button for games not yet in the catalogue; creates a `game_requests` record (title, requester info, vote count) visible in Backstage. Admin performs high-fidelity onboarding at their own pace; game moves from `pending` → `ready` and becomes selectable by all users.
- **Request schema** — `game_requests` table: `id`, `title`, `requester_id`, `vote_count`, `status` (`pending` / `in_progress` / `ready` / `rejected`), `linked_game_id` (nullable FK to `games`), `created_at`.
- **Backstage request queue** — view and manage pending requests; promote a request to a full game record and trigger onboarding from within Backstage.

## Curation Tuning

- **Resolve YouTube videos before tagging** — move YouTube video resolution ahead of the LLM tagging step in the onboarding pipeline; avoids wasting tagger tokens on bad track names that have no matching YouTube video.
- **Tagger role skew validation** — if >50% of game's tracks are `ambient`, re-tag with role-diversity bias.
- **Per-game soft cap tuning** — revisit 40% soft cap if users report thin single-game playlists.
- **Focus mode budget hardening** — option to enforce strict "always N tracks per focus game" (currently soft guarantee).

## Curation Intelligence

Current Vibe Check uses random 2.5× sample. For large libraries, only ~8% of tracks get scored.

- **Vibe input UI** _(depends on Vibe Profiler)_ — structured selectors: **Energy** (Calm / Balanced / Intense) + **Activity** (Study, Gaming, Commute, Exercise, Relaxing).

## Per-user Generation Caps

- **Daily generation limit** — per logged-in user, enforced via KV counter. Cap stored in DB for per-user admin overrides via Backstage.

## Bugs

## Backstage

- **Inline track name editing** — allow admin to manually edit track names in Backstage (e.g. via the TrackEditSheet or inline in the track table).
- **Bulk retag selection** — allow admin to multi-select tracks and trigger a retag on just the selected subset.
- **Prominent "Run full pipeline" for draft games** — make the full pipeline button more prominent when a game is in draft phase, and less prominent otherwise; add a confirmation dialog since it's a destructive/unexpected action on non-draft games.
- **Manual VGMdb onboarding in Backstage** — add a button on a game's Backstage page to onboard/re-onboard its soundtrack from VGMdb using a manually provided VGMdb album ID, as an alternative to the automatic Discogs-based onboarding.
- **Additive onboarding (merge semantics)** — manual onboarding (and re-onboarding generally) should behave like a merge: existing track/metadata values are preserved and only new data is added. A separate "clean onboard" option should be available when the user explicitly wants to discard existing data and start fresh.
- **User/Admin view toggle** — add a persistent toggle that switches between user and admin experience; admin mode surfaces all admin-only affordances (e.g. Backstage quick-open on tracks, dev overlays) without requiring separate accounts.
- **Quick-open in Backstage from playlist track** — admin-only dev affordance on each playlist track card (e.g. small icon) that navigates directly to that track's game in Backstage for quick metadata edits.
- **Users page in Backstage** — once multi-user auth is in place, add a `/backstage/users` view to manage users (activity, library stats, account status, etc.).

---

## Deferred (Next Major Phase)

These are solid but blocked on auth or infrastructure changes:

- **Production hardening** — multi-user auth, ownership checks, rate limiting, token expiration. See PRODUCTION_HARDENING_WORKDOC.md.
- **Free/Account tier split** — localStorage for free users, backend for account users, capability gating. Requires auth.
- **Playlist seed share** — encode playlists as compact strings; `/share/[seed]` read-only view. Lower priority.
