# What's Coming

## Testing & Quality

- **Vitest setup** — install Vitest with TypeScript support and path alias resolution for `@/`; add `test`, `test:watch`, and `test:coverage` scripts to package.json
- **Pure function unit tests** — test the YouTube service (`parseDuration`, REJECT_KEYWORDS filtering), mappers (`parseSearchQueries`, `toGame`, `toPlaylistSession`), and extracted candidate slot math from the pipeline
- **Repository integration tests** — spin up in-memory SQLite databases for each test suite; verify repo layer behavior: session FIFO eviction, game cascading removal, `bulkImportSteam` deduplication, and `ACTIVE_SESSION_SQ` correctness
- **Pipeline unit tests** — refactor `generatePlaylist` to accept LLM and YouTube providers as parameters (dependency injection) instead of resolving them internally; mock providers to test orchestration logic, curation mode branching, and slot allocation math without touching real services
- **LLM response parsing** — add unit tests for the curation and candidates services to verify they handle malformed JSON gracefully and apply fallback logic correctly

**Rationale:** This is a foundational quality gate before schema refactors. The repo layer and pipeline orchestration are high-risk, low-test areas. Achieving >80% coverage on `lib/` buys confidence for major architectural changes.

## Player

- **Repeat modes** — off / repeat all / repeat one
- **Mini video view** — expand the player to show the actual YouTube video inline
- **Chapter markers for Full OST videos** — when a long compilation is playing, parse the YouTube description for timestamps and render notches on the seekbar; hover to see the chapter name, click to jump there

## Playlist

- **Track rating** — Thumbs Up / Thumbs Down while a track plays; liked/disliked video IDs are stored and injected into the Phase 3 curation prompt as explicit keep/avoid hints on the next run
- **Track blacklist** — permanently mark a video as "never include this again"; persisted to DB and filtered during Phase 2 candidate selection
- **Playlist preview before commit** — after Phase 3 returns, surface the ordered track list for review before saving; allow swapping or removing individual tracks in that moment
- **Playlist text/CSV export** — export current playlist as plain text or CSV (distinct from YouTube sync); useful for copying tracklists or sharing outside the app
- **Playlist seed export/import** — encode the current playlist as a compact string (video ID + game name per entry) and surface a share button; pasting a valid seed recreates the exact playlist instantly, no generation needed; depends on the `/share/[seed]` page

## Library

- **Playlist cache refresh** — a button per game to force BGMancer to re-discover its YouTube playlist (useful when an OST upload gets taken down or replaced)
- **Bulk text import** — paste a list of game titles to add multiple games at once
- **"The Essentials" empty state** — when the library is empty, show a curated starter set (e.g. Chrono Trigger, Halo, Doom, Persona 5) as one-click adds; a first-time user should hear music within 3 clicks

## Curation Intelligence

- **Curation mood hint** — a free-text field on the generate panel (e.g. "focus session", "driving late at night", "boss rush energy") that gets appended to the Phase 3 system prompt; stored as a single `curation_hint` config value
- **Cross-session uniqueness** — when generating a new session, bias against tracks that already appear in recent sessions so consecutive runs feel genuinely different
- **MusicBrainz enrichment** — enrich track metadata (artist, mood tags) from MusicBrainz after each generation and cache it in `mb_track_cache`; feed cached tags into Phase 2 and Phase 3 prompts as structured energy/mood signal. Low hit-rate on game OSTs (~29% tags, ~55% artist in early testing) means it's a hint, not a hard requirement. Implementation was scaffolded but removed pending better coverage or an alternative metadata source

## Full OST mode

Re-expose the per-game toggle that makes BGMancer find a single long compilation video for a game instead of individual tracks. The underlying pipeline logic is already in place (`allow_full_ost` column + generation path in `src/lib/pipeline/`) — the UI toggle was removed; just needs to be surfaced again.

## YouTube

- **YouTube quota indicator** — show estimated daily quota remaining or surface a warning at generation start; the hard quota limit is a real source of pain when generating often
- **Revisit YouTube sync strategy** — the current "sync to YouTube playlist" feature was designed for single-user mode; with cookie-based anonymous multi-user sessions, the UX/infrastructure for YouTube sync needs rethinking (users don't sign in, so OAuth linkage is ephemeral)

## Quality of Life

- **Keyboard shortcuts** — Space to play/pause, ← / → for previous/next, `m` to mute/dim; show a shortcuts cheat-sheet on `?`
- **Mobile layout** — the UI is desktop-first; a responsive pass for smaller screens and the player bar on mobile would make it genuinely usable on phones
- **PWA install** — add a web app manifest + service worker so BGMancer can be added to the home screen; pairs with mobile layout work
- **Legal disclaimer footer** — a site-wide footer with links to LICENSE, attribution, and privacy notice
- **Quick-Add suggestions** — based on your active games, suggest related titles to add with one click (Steam "players also play" data or a simple genre tag system)

## Stats & Insights

A `/stats` page surfacing data already captured in the DB — no new tracking needed:

- **Games breakdown** — which games appear most often across your sessions, and how many tracks each contributed on average
- **Total listening time** — cumulative runtime across all saved sessions
- **Reroll & error heatmap** — tracks most frequently rerolled or stuck in error state; surfaces games the LLM consistently misjudges or YouTube has poor coverage for
- **Track status trends** — found vs. pending vs. error rates per session over time, useful for diagnosing YouTube quota pressure

## Admin & Developer

- **Admin dashboard** (`/admin`) — password-protected route for monitoring:
  - YouTube API quota consumption and daily reset countdown
  - Active session count
  - Disk usage per session
  - Manual session purge controls
  - Error logs and generation history
- **Health endpoint** — `GET /api/health` returning DB status, Ollama connectivity, and YouTube API key validity; useful for self-hosters diagnosing config issues without grepping logs

## New Pages

- **`/share/[seed]`** — a landing page for shared playlists. Depends on the playlist seed export/import feature (see Playlist section above); a visitor who follows a share link sees a read-only playlist view and can clone it into their own library with one click

## Launch Readiness

- **Config persistence** — app config (track count, anti-spoiler, allow long tracks) is currently stored in `localStorage`; if a user clears their browser storage they lose preferences. Consider persisting to DB per user, or at minimum storing in the JWT-backed cookie session
- **Anonymous session expiry** — there's no TTL on anonymous user sessions; the DB will accumulate stale rows from one-time visitors. Add a cleanup job (e.g. CRON or on-startup sweep) to delete users inactive for >30 days
- **Self-host documentation** — comprehensive `GETTING_STARTED.md` covering YouTube API key setup, Ollama installation, environment config, and troubleshooting common first-run issues
- **Live demo deployment** — host a public instance to showcase the product

## Tier UX & Settings

- **Tier switcher UI** — a settings panel where users can view their current tier (Bard/Maestro) and switch between them; currently controlled only by whether `ANTHROPIC_API_KEY` is set, which isn't surfaced anywhere
- **Ollama model selector** — expose `OLLAMA_MODEL` in a settings UI so users can pick between locally installed models without restarting the server
- **Tier documentation** — update README with clear tier comparison (Bard = Ollama only, Maestro = Claude when key present)

## Hosting

- **Session data export** — let a user download their full library + config as a JSON bundle to back up or migrate before their session expires
- **Optional Google sign-in for persistence** — link an anonymous session to a Google account so the library survives cookie clears and works across devices

## Abuse Prevention & Public Launch Safeguards

### Rate Limiting & Request Throttling (Tier 2 & Beyond)

- **YouTube API quota budgets** — assign per-session daily quota limits (e.g., Bard tier gets 500/day, Maestro gets 5000/day); track quota spend and reject requests once exceeded
- **LLM token budgets** — cap tokens per generation and track cumulative spend per session to prevent runaway costs on Claude/Ollama

### Storage & Data Limits (Tier 2 & Beyond)

- **Per-session storage quota** — implement quota tracking (e.g., 50 MB per session) to prevent disk bloat; archive old playlists instead of deleting

### Input Validation & Security

- **Input sanitization** — sanitize all user input (game titles, session names, search queries, mood hints) to prevent injection attacks beyond basic constraints already in place
- **Steam import cap per batch** — consider bounding max games per single Steam import to prevent one-shot library flooding (e.g., 100 games per import, but library cap of 500 total is primary constraint)

### Active Games Limit During Curation

- **Hard limit on active games per generation** — cap the number of games that can contribute to a single playlist curation (e.g., max 50 active games); if library exceeds this, user must mark games as skipped to stay within limit; prevents combinatorial explosion of LLM prompt complexity and YouTube API spam

### Usage Analytics & Monitoring

- **Per-session usage logging** — track generation count, quota spend, storage usage, and error rates to identify abuse patterns
- **Abuse detection alerts** — flag sessions that exceed thresholds (e.g., 10+ generations in 1 hour, quota spend > 90% daily limit)
