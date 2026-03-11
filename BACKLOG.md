# What's Coming

## Testing & Quality

- **Vitest setup** — install Vitest with TypeScript support and path alias resolution for `@/`; add `test`, `test:watch`, and `test:coverage` scripts to package.json
- **Pure function unit tests** — test the YouTube service (`parseDuration`, REJECT_KEYWORDS filtering), mappers (`parseSearchQueries`, `toGame`, `toPlaylistSession`), and extracted candidate slot math from the pipeline
- **Repository integration tests** — spin up in-memory SQLite databases for each test suite; verify repo layer behavior: session FIFO eviction, game cascading removal, `bulkImportSteam` deduplication, and `ACTIVE_SESSION_SQ` correctness
- **Pipeline unit tests** — refactor `generatePlaylist` to accept LLM and YouTube providers as parameters (dependency injection) instead of resolving them internally; mock providers to test orchestration logic, curation mode branching, and slot allocation math without touching real services
- **Director unit tests** — `assemblePlaylist` in `src/lib/pipeline/director.ts` is pure TypeScript with no I/O; high-value test target. Verify arc shape (intro slots get energy≤2, climax slots get energy=3), per-game budget enforcement, no-consecutive-same-game constraint, and graceful pool exhaustion behavior
- **Tagger response parsing** — add unit tests for `parseTagResponse` in `src/lib/pipeline/tagger.ts` to verify it handles malformed JSON, missing fields, out-of-range energy values, and unknown role strings gracefully

**Rationale:** This is a foundational quality gate before schema refactors. The repo layer and pipeline orchestration are high-risk, low-test areas. Achieving >80% coverage on `lib/` buys confidence for major architectural changes.

## Player

- **Repeat modes** — off / repeat all / repeat one
- **Mini video view** — expand the player to show the actual YouTube video inline
- **Chapter markers for Full OST videos** — when a long compilation is playing, parse the YouTube description for timestamps and render notches on the seekbar; hover to see the chapter name, click to jump there

## Playlist

- **Better auto-generated session names** — the current name is just a comma-joined list of game titles (e.g. "Elden Ring, Hades, Celeste"). Consider having the LLM produce a short evocative title based on the games and mood — something like "Soulsborne Descent" or "Indie Chill Mix" — as a cheap side-call at the end of generation. The tagged track pool (energy distribution, dominant roles) is already available and could be passed as structured input. Fallback to the game-list name if the call fails.

- **Track rating** — Thumbs Up / Thumbs Down while a track plays; liked/disliked video IDs stored in DB; on next generation pass them to `assemblePlaylist` as a boost/penalty weight on the tagged pool (liked tracks score +2, disliked are excluded from the pool before the Director sees it)
- **Track blacklist** — permanently mark a video as "never include this again"; persisted to DB and filtered from `tagGameTracks` output before the Director sees the pool
- **Playlist preview before commit** — after arc assembly returns, surface the ordered track list for review before saving; allow swapping or removing individual tracks in that moment
- **Playlist text/CSV export** — export current playlist as plain text or CSV (distinct from YouTube sync); useful for copying tracklists or sharing outside the app
- **Playlist seed export/import** — encode the current playlist as a compact string (video ID + game name per entry) and surface a share button; pasting a valid seed recreates the exact playlist instantly, no generation needed; depends on the `/share/[seed]` page
- **Rethink track reroll** - do we want it? can we make sure its not abused?

## Library

- **Playlist cache refresh** — a button per game to force BGMancer to re-discover its YouTube playlist (useful when an OST upload gets taken down or replaced)
- **Bulk text import** — paste a list of game titles to add multiple games at once
- **"The Essentials" empty state** — when the library is empty, show a curated starter set (e.g. Chrono Trigger, Halo, Doom, Persona 5) as one-click adds; a first-time user should hear music within 3 clicks

## Curation Intelligence

- **Curation mood hint** — a free-text field on the generate panel (e.g. "focus session", "driving late at night", "boss rush energy") stored as `curation_hint` config value; would influence Director arc shape (e.g. "focus" boosts ambient/build weight, "boss rush" boosts combat/peak fraction) rather than going into an LLM prompt
- **Cross-session uniqueness** — bias against tracks that already appear in recent sessions so consecutive runs feel different; `track_tags` table already has `video_id` + `game_id`, so recent session video IDs can be passed to `assemblePlaylist` as a soft-exclude set
- **MusicBrainz enrichment** — enrich track metadata (artist, mood tags) from MusicBrainz after each generation and cache it alongside `track_tags`; could improve energy/role accuracy beyond what LLM title-reading achieves. Low hit-rate on game OSTs (~29% tags, ~55% artist in early testing) means it's a hint, not a hard requirement

## Curation Tuning

The Tagger + Director architecture replaced the old LLM Phase 2/Phase 3 pipeline. Most of the previous "Curation Overhaul" problems are solved: arc shaping applies to all games including single-game, pool size increased from 30 to 80, fill tracks are arc-curated, name cleaning is folded into tagging. Remaining improvement surface:

**Tagger prompt quality**

- `cleanName` still has edge cases — the current prompt handles most patterns but struggles with tracks where the game title appears mid-string or where the track is credited to a radio station (see examples below). Adding more few-shot examples to `TAGGER_SYSTEM` in `src/lib/pipeline/tagger.ts` is the fastest fix.
- Energy/role classification by llama3.2 can be coarse for obscure OSTs — Maestro tier (Claude haiku) is noticeably more accurate. Could add a validation pass: if >50% of a game's tracks land on `role="ambient"`, re-tag with a different prompt that biases toward more specific roles.

```
game: Grand Theft Auto III – The Definitive Edition
track: GTA III (GTA 3) - Game FM | Agallah + Sean Price - "Rising to the Top"
expected cleanName: Rising to the Top   ← radio station format, title is the last segment
```

```
game: Aeruta
track: Elite Strategist - Aeruta (OST) | Red Eyes Studios
expected cleanName: Elite Strategist   ← title appears before the game name
```

**Director arc tuning**

- Arc phase fractions are hardcoded in `ARC_TEMPLATE` in `src/lib/pipeline/director.ts`. Could make them configurable per mood hint (above) or expose a "session shape" preset (e.g. "chill", "epic", "balanced").
- The 40% per-game soft cap in `computeGameBudgets` can be too tight for single-game sessions — already handled by fallback but worth revisiting if users report thin pools.
- Focus mode currently gets a 2× budget weight; old behavior was a hard guaranteed-slot bypass of curation entirely. If users want strict "always N tracks from this game" guarantees, the pre-assignment logic in `assemblePlaylist` needs to be hardened (remove the `if (track)` guard and error if pool is insufficient).

**Tag cache invalidation**

- `track_tags` rows are never invalidated. If a YouTube playlist is updated (new upload replaces a taken-down track), old tags linger. A `db:reset` clears them, but a per-game refresh button (already in Library backlog) should also call `TrackTags.deleteByGame(gameId)` to force re-tagging on next generation.

## Full OST mode

Re-expose the per-game toggle that makes BGMancer find a single long compilation video for a game instead of individual tracks. The underlying pipeline logic is already in place (`allow_full_ost` column + generation path in `src/lib/pipeline/`) — the UI toggle was removed; just needs to be surfaced again.

## Track Tag Database

`track_tags` is quietly becoming a local metadata store for YouTube game OST videos (`video_id + game_id → cleanName, energy, role, isJunk`). Tags are game-universal — a combat theme is a combat theme regardless of who generated it. This has compounding value:

- **Cache durations alongside tags** — add `duration_seconds` to `track_tags`; first generation pays the `fetchVideoDurations` API cost, subsequent re-generations of the same library skip it entirely. Duration could also feed the tagger as a signal (flag anything <60s as junk without an LLM call). Schema change: add `duration_seconds INTEGER` column to `track_tags`, populate it in `tagger.ts` after the duration fetch in `index.ts`.
- **Shared tag cache across users** — the current schema has no user dimension (`PRIMARY KEY (video_id, game_id)`), so tags are already shareable. Today they're implicitly per-user because games are per-library, but in a multi-user deployment the first person to tag "Hollow Knight" pays the LLM cost and everyone else gets it free. No schema change needed — just stop scoping tag queries through the user's library.
- **Seeded tag database** — pre-tag the 50 most common game OSTs and ship the data in `data/track-tags.json` alongside the existing `data/yt-playlists.json`. New installs get quality arc results on day one with zero LLM calls. The `syncYtPlaylistSeeds` pattern in `src/lib/db/seed.ts` is the model to follow.
- **Tag export/import** — let power users export their accumulated tag DB and share it; a community-sourced tag corpus would eventually make the LLM tagging step optional for well-covered OSTs.

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
