# What's Coming

## Testing & Quality

- **Vitest setup** — install Vitest with TypeScript support and `@/` path alias resolution; add `test`, `test:watch`, and `test:coverage` scripts. Foundational before any schema refactors.
- **Pure function unit tests** — cover `parseDuration`, REJECT_KEYWORDS filtering, and mapper functions (`parseSearchQueries`, `toGame`, `toPlaylistTrack`).
- **Repository integration tests** — spin up in-memory SQLite per suite; verify session FIFO eviction, game cascading removal, `bulkImportSteam` deduplication.
- **Director unit tests** — `assemblePlaylist` is pure TS with no I/O; verify arc shape, per-game budget enforcement, no-consecutive-same-game constraint, pool exhaustion fallback.
- **Tagger response parsing tests** — verify robustness to malformed JSON, missing fields, out-of-range energy values.

## Player

- **Repeat modes** — off / repeat all / repeat one.
- **Keyboard shortcuts** — Space (play/pause), ←/→ (prev/next), `m` (mute), `?` (help).
- **State retention** — remember playback position on reload; resume from that track.

## Playlist & UX

- **Play button** — add a play/start button to begin the playlist from the first track without having to click it manually.
- **Clickable Discogs ID** — make the Discogs ID in the game library link to the corresponding Discogs page.
- **Track rating** — thumbs up / down while playing; seed data for future personalization.
- **Track blacklist** — permanently exclude a video from future generations.
- **Better session names** — optional LLM side-call to produce evocative names (e.g. "Soulsborne Descent") from track energy and roles.
- **Playlist preview before commit** — review assembled tracks before saving; allow manual swaps/removals.
- **Playlist export** — export as plain text or CSV.
- **Mobile layout** — responsive design for phone/tablet.
- **PWA install** — web app manifest + service worker for home screen install.

## Library Management

- **Playlist cache refresh** — per-game button to force re-discovery of YouTube OST ID; clears cached tags.
- **Bulk text import** — paste newline-separated game titles to add multiple at once.

## Walled Garden (Curated Library Model)

Shift from an open "add any game" model to a **pre-onboarded master library**. Every game visible to users is guaranteed to have full tag coverage (energy, role, moods, instrumentation), eliminating the metadata-integrity problems that cause floor-scoring and weak Director output.

- **Master library browse** — replace the "Add Game" free-text input with a gallery/search over the pre-approved game catalogue. Users pick from games that are already fully onboarded.
- **"Request a Game" flow** — a request button for games not yet in the catalogue; creates a `game_requests` record (title, requester info, vote count) visible in Backstage. Admin performs high-fidelity onboarding at their own pace; game moves from `pending` → `ready` and becomes selectable by all users.
- **Request schema** — `game_requests` table: `id`, `title`, `requester_id`, `vote_count`, `status` (`pending` / `in_progress` / `ready` / `rejected`), `linked_game_id` (nullable FK to `games`), `created_at`.
- **Backstage request queue** — view and manage pending requests; promote a request to a full game record and trigger onboarding from within Backstage.
- **Remove Steam / open-text import from the main app** — move Steam bulk-import to a Backstage-only admin tool for seeding the master catalogue; users never trigger raw ingestion.

## Curation Tuning

- **YouTube view count as popularity signal** — fetch and cache view counts for tracks; use as a soft weight in Director assembly so more-popular tracks are favoured. Expose as a user toggle (similar to allow long/short tracks) so users can opt in or out of popularity bias.

- **Director: Legacy Score ($S_{leg}$)** — add a fourth resonance dimension that balances global popularity with per-game stature, solving both the "Mainstream Bot" (raw views favour AAA) and "no Best-Of feel" (pure intra-game rank loses global signal) problems.

  **Formula:**
  - **Global Heat** = `log10(views)`, normalized to `0.0–1.0` over the range `[3, 7]` (1k–10M views)
  - **Local Stature** = `trackViews / avgViewsForGame` (a track with 500k views in a 50k-avg game scores 10×; same track in a 2M-avg game scores 0.25×), then normalized
  - **Legacy Score** = `(GlobalHeat × 0.6) + (LocalStature × 0.4)`
  - **Baseline** = `0.3` for tracks with no view data (avoids floor-penalizing obscure/new games)

  **Updated Director resonance weights (when Legacy toggle is on):**
  | Dimension | Weight |
  |-----------|--------|
  | Role | 0.30 |
  | Mood | 0.25 |
  | Legacy | 0.30 |
  | Instrumentation | 0.15 |

  View counts should be fetched from the YouTube API during soundtrack ingestion and cached in `track_tags`. Depends on the "YouTube view count" toggle above.

- **Tagger role skew validation** — if >50% of game's tracks are `ambient`, re-tag with role-diversity bias.
- **Per-game soft cap tuning** — revisit 40% soft cap if users report thin single-game playlists.
- **Focus mode budget hardening** — option to enforce strict "always N tracks per focus game" (currently soft guarantee).

## Track Metadata

Current `track_tags` schema is functional but minimal: `video_id + game_id → cleanName, energy, role, moods, instrumentation`. Growth paths:

- **Cache durations** — add `duration_seconds` to `track_tags`; eliminates `fetchVideoDurations` API call on repeat generations.
- **YouTube description parsing** — extract role/context hints from video descriptions and tags before LLM tagging.
- **Shared tag cache** — tags are already user-agnostic; stop scoping through per-user library so first tagger pays cost for everyone.
- **Seed tag database** — pre-tag 50+ common OSTs in `data/track-tags.json`; new installs get quality results on day one.
- **Tag export/import** — let users export their tags as JSON; community corpus makes LLM tagging optional for well-covered games.

## Curation Intelligence

Current Vibe Check (Maestro only) uses random 2.5× sample. For large libraries, only ~8% of tracks get scored.

- **Vibe input UI** _(depends on Vibe Profiler)_ — structured selectors: **Energy** (Calm / Balanced / Intense) + **Activity** (Study, Gaming, Commute, Exercise, Relaxing).

## Bugs

- **Generating a new playlist resets the player** — starting a new generation should not interrupt the currently playing track; the new session should be created in the background and become selectable without stopping playback.
- **Deleting a non-active session resets the player** — deleting a session that is not currently playing should leave the active session and player state untouched.
- **Backstage elements not interactable** — some fields in the Backstage UI cannot be edited (e.g. energy value selector); inputs appear rendered but don't respond to interaction.

## Backstage

- **Manual VGMdb onboarding in Backstage** — add a button on a game's Backstage page to onboard/re-onboard its soundtrack from VGMdb using a manually provided VGMdb album ID, as an alternative to the automatic Discogs-based onboarding.
- **Additive onboarding (merge semantics)** — manual onboarding (and re-onboarding generally) should behave like a merge: existing track/metadata values are preserved and only new data is added. A separate "clean onboard" option should be available when the user explicitly wants to discard existing data and start fresh.
- **User/Admin view toggle** — similar to the Bard/Maestro tier toggle, add a persistent toggle that switches between user and admin experience; admin mode surfaces all admin-only affordances (e.g. Backstage quick-open on tracks, dev overlays) without requiring separate accounts.
- **Quick-open in Backstage from playlist track** — admin-only dev affordance on each playlist track card (e.g. small icon) that navigates directly to that track's game in Backstage for quick metadata edits.

## Quality of Life

- **Better error messages** — when YouTube discovery fails, show "not in YouTube catalog" instead of generic error.

---

## Deferred (Next Major Phase)

These are solid but blocked on auth or infrastructure changes:

- **Production hardening** — multi-user auth, ownership checks, rate limiting, token expiration. See PRODUCTION_HARDENING_WORKDOC.md.
- **Free/Account tier split** — localStorage for free users, backend for account users, capability gating. Requires auth.
- **Tier-based backfill** — pre-tag 200+ popular OSTs for free tier. Requires tier model.
- **Playlist seed share** — encode playlists as compact strings; `/share/[seed]` read-only view. Lower priority.
