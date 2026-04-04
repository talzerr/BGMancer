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
- **Mobile layout** — responsive design for phone/tablet. The catalog library drawer should become a collapsible bottom sheet on mobile viewports.
- **Collapsible library drawer** — on mobile, the library drawer should be toggleable (collapsed by default, expand on tap). Desktop keeps it always visible.
- **PWA install** — web app manifest + service worker for home screen install.

## Library & Integration

- **User-facing Steam import** — let users import their Steam game list directly (currently admin-only via Backstage).

## Walled Garden (Curated Library Model)

- **"Request a Game" flow** — a request button for games not yet in the catalogue; creates a `game_requests` record (title, requester info, vote count) visible in Backstage. Admin performs high-fidelity onboarding at their own pace; game moves from `pending` → `ready` and becomes selectable by all users.
- **Request schema** — `game_requests` table: `id`, `title`, `requester_id`, `vote_count`, `status` (`pending` / `in_progress` / `ready` / `rejected`), `linked_game_id` (nullable FK to `games`), `created_at`.
- **Backstage request queue** — view and manage pending requests; promote a request to a full game record and trigger onboarding from within Backstage.

## Curation Tuning

- **Tagger role skew validation** — if >50% of game's tracks are `ambient`, re-tag with role-diversity bias.
- **Per-game soft cap tuning** — revisit 40% soft cap if users report thin single-game playlists.
- **Focus mode budget hardening** — option to enforce strict "always N tracks per focus game" (currently soft guarantee).

## Curation Intelligence

Current Vibe Check uses random 2.5× sample. For large libraries, only ~8% of tracks get scored.

- **Vibe input UI** _(depends on Vibe Profiler)_ — structured selectors: **Energy** (Calm / Balanced / Intense) + **Activity** (Study, Gaming, Commute, Exercise, Relaxing).

## Per-user Generation Caps

- **Admin-configurable cap** — move the daily LLM generation limit from a hardcoded constant to a DB-backed setting with per-user admin overrides via Backstage.

## Pre-Launch

- **IMPORTANT: Verify admin route protection after removing site-wide Zero Trust** — Currently the entire site is behind Cloudflare Zero Trust. Once it goes public, only `bgmancer.com/backstage*` will remain behind Access. The `/api/steam/*` routes (`/api/steam/search`, `/api/steam/games`, `/api/steam/import`) are `AuthLevel.Admin` in route-config and protected by the middleware `CF_Authorization` cookie check, but they are NOT under the `/backstage*` path. Verify these routes return 404 to unauthenticated users after the Access policy is narrowed.

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

## Deferred

- **Playlist seed share** — encode playlists as compact strings; `/share/[seed]` read-only view.
