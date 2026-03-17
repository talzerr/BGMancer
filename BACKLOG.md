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

## Curation Tuning

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

## Quality of Life

- **Better error messages** — when YouTube discovery fails, show "not in YouTube catalog" instead of generic error.

---

## Deferred (Next Major Phase)

These are solid but blocked on auth or infrastructure changes:

- **Production hardening** — multi-user auth, ownership checks, rate limiting, token expiration. See PRODUCTION_HARDENING_WORKDOC.md.
- **Backstage admin UI** — inspect / correct track metadata. See BACKSTAGE_DESIGN.md.
- **Free/Account tier split** — localStorage for free users, backend for account users, capability gating. Requires auth.
- **Tier-based backfill** — pre-tag 200+ popular OSTs for free tier. Requires tier model.
- **Playlist seed share** — encode playlists as compact strings; `/share/[seed]` read-only view. Lower priority.
