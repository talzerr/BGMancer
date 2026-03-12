# What's Coming

## Testing & Quality

- **Vitest setup** — install Vitest with TypeScript support and `@/` path alias resolution; add `test`, `test:watch`, and `test:coverage` scripts. Foundational before any schema refactors.
- **Pure function unit tests** — cover `parseDuration`, REJECT_KEYWORDS filtering, and the mapper functions (`parseSearchQueries`, `toGame`, `toPlaylistSession`).
- **Repository integration tests** — spin up in-memory SQLite per suite; verify session FIFO eviction, game cascading removal, `bulkImportSteam` deduplication, and `ACTIVE_SESSION_SQ` correctness.
- **Pipeline unit tests** — inject LLM and YouTube providers as parameters into `generatePlaylist` so orchestration logic, curation mode branching, and slot allocation can be tested without real services.
- **Director unit tests** — `assemblePlaylist` is pure TS with no I/O; verify arc shape (intro ≤ energy 2, climax = energy 3), per-game budget enforcement, no-consecutive-same-game, and pool exhaustion fallback.
- **Tagger response parsing tests** — verify `parseTagResponse` handles malformed JSON, missing fields, out-of-range energy values, and unknown role strings.

## Player

- **Repeat modes** — off / repeat all / repeat one.
- **Mini video view** — expand the player bar to show the YouTube video inline.
- **Chapter markers for Full OST videos** — parse YouTube description timestamps into seekbar notches; hover to see chapter name, click to jump.

## Playlist

- **Better session names** — LLM side-call at generation end to produce a short evocative title (e.g. "Soulsborne Descent") from the energy distribution and dominant roles of the assembled tracks. Falls back to the current game-list name if the call fails.
- **Track rating** — thumbs up / down while playing; liked tracks score +2 in the Director pool, disliked tracks are excluded before assembly.
- **Track blacklist** — permanently exclude a video; persisted to DB and filtered from `tagGameTracks` output on every generation.
- **Playlist preview before commit** — surface the assembled track list for review before saving; allow swapping or removing individual tracks.
- **Playlist export** — export as plain text or CSV (distinct from YouTube sync).
- **Playlist seed share** — encode the playlist as a compact string (video ID + game per entry); pasting a seed recreates it instantly. Depends on `/share/[seed]` page.
- **Track reroll** — reconsider scope and abuse surface before keeping; currently a one-click replacement with no rate limit.
- **`/share/[seed]` page** — read-only playlist view for shared seeds; one-click clone into visitor's library.

## Library

- **Playlist cache refresh** — per-game button to force re-discovery of the YouTube OST playlist; also clears `track_tags` for that game to force re-tagging.
- **Bulk text import** — paste a newline-separated list of game titles to add multiple games at once.
- **"The Essentials" empty state** — show a curated starter set (e.g. Chrono Trigger, Halo, Doom, Persona 5) as one-click adds when the library is empty.

## Curation Intelligence

The current Vibe Check (Maestro only) scores a random 2.5× sample of the candidate pool before the Director runs. For large libraries (~15 games × 100 tracks) only ~8% of tracks get a fitScore — the rest default to neutral (50) and fall back to tag-only arc selection.

- **Vibe Profiler** _(next step — requires enriched tags)_ — instead of grading individual tracks, the LLM produces a **scoring rubric**: a JSON profile of what the session mood means in terms of enriched tag vocabulary (`idealMoods`, `idealInstrumentation`, `positiveComposers`, `positiveFranchises`, etc.). Pure TypeScript then scores 100% of the library against the rubric in O(n). Single LLM call, full pool coverage, scales to any library size. Blocked on enriched track metadata (see Track Metadata Enrichment).

- **Vibe input (UI)** _(depends on Vibe Profiler)_ — structured selectors rather than free-text: **Energy** (Calm / Balanced / Intense) + **Activity** (Study/Work, Gaming, Commute, Exercise, Relaxing). Free-text was rejected — abstract OST names like "Zanarkand" or "Corridors of Time" don't contain mood keywords, so keyword matching only works once enriched tags exist.

- **Enriched tag taxonomy** — tags needed to make the Vibe Profiler work, each with a defined pipeline role:

  | Category            | Tags                                                       | Role                                   |
  | ------------------- | ---------------------------------------------------------- | -------------------------------------- |
  | **Identity**        | `composer`, `franchise`, `game_genre`, `era`               | Rubric matching; cross-game similarity |
  | **Acoustic**        | `bpm`, `valence`, `acousticness`, `danceability`           | Numeric rubric scoring; arc tuning     |
  | **Emotional**       | `mood[]` (melancholic, triumphant, tense, peaceful, epic…) | Primary rubric target                  |
  | **Instrumentation** | `instrumentation[]` (orchestral, synth, chiptune, piano…)  | Cohesion; "feel" matching              |
  | **Context**         | `in_game_context` (boss fight, area theme, credits…)       | Finer Director slot matching           |

  Sources: Spotify Audio Features (acoustic) → VGMDB/MusicBrainz (identity) → YouTube description/tags (context) → LLM enrichment pass (emotional/instrumentation) → LLM title inference (current fallback, least reliable).

- **Arc mood presets** — expose arc phase fractions as configurable presets (e.g. "chill", "epic", "balanced") rather than hardcoding them in `ARC_TEMPLATE`; pairs naturally with the Vibe input selectors above.

- **Cross-session uniqueness** — soft-exclude tracks that appeared in recent sessions; `track_tags` already has `video_id` + `game_id`, so recent session IDs can be passed to `assemblePlaylist` as a penalty weight.

## Curation Tuning

- **Tagger `cleanName` edge cases** — add few-shot examples to `TAGGER_SYSTEM` for radio-station format (`"Game FM | Artist - Track Title"` → last segment) and title-before-game format (`"Track Name - Game (OST)"` → first segment).
- **Tagger role skew validation** — if >50% of a game's tracks land on `role="ambient"`, re-tag with a prompt that biases toward more specific roles; common with llama3.2 on obscure OSTs.
- **Per-game soft cap tuning** — the 40% soft cap in `computeGameBudgets` can be too tight for single-game sessions; revisit if users report thin playlists.
- **Focus mode budget hardening** — Focus currently gets 2× budget weight with a soft guarantee; if strict "always N tracks" is needed, remove the `if (track)` guard in `assemblePlaylist` and error on insufficient pool.
- **Tag cache invalidation** — `track_tags` rows are never invalidated; the per-game playlist cache refresh button (Library backlog) should also call `TrackTags.deleteByGame(gameId)`.

## Full OST Mode

Re-expose the per-game toggle for single-compilation mode. Pipeline logic is in place (`allow_full_ost` column + generation path) — the UI toggle was removed and just needs to be surfaced again.

## Track Metadata

`track_tags` is the app's persistent metadata store (`video_id + game_id → cleanName, energy, role, isJunk`). Tags are user-agnostic — the same combat theme is a combat theme for everyone. Growth directions:

- **Cache durations** — add `duration_seconds` to `track_tags`; eliminates the `fetchVideoDurations` API call on repeat generations. Tracks <60s can be flagged as junk without an LLM call.
- **Shared tag cache** — tags already have no user dimension (`PRIMARY KEY (video_id, game_id)`); stop scoping tag queries through the user's library so the first person to tag "Hollow Knight" pays the cost for everyone.
- **Seeded tag database** — pre-tag the 50 most common game OSTs and ship as `data/track-tags.json`; follow the `syncYtPlaylistSeeds` pattern. New installs get arc-quality results on day one with zero LLM calls.
- **Tag export/import** — let users export their `track_tags` as JSON; a community corpus eventually makes LLM tagging optional for well-covered OSTs.
- **YouTube description + tags** _(free, no new API key)_ — many OST uploads include role context in the description and YouTube tags ("boss theme", "area music"). Pass `description` and `tags` from `fetchPlaylistItems` into the tagger prompt; could also pattern-match directly (tag contains "boss" → `role="combat"`). Requires extending `OSTTrack` in `youtube.ts`.
- **Spotify Audio Features** — ground-truth acoustic measurements (`energy`, `valence`, `bpm`, `acousticness`, `danceability`) per track from the audio waveform. Directly replaces LLM energy/role guessing for any OST on Spotify. Flow: tagger LLM reads the messy YouTube title and outputs a structured Spotify search query (`trackName`, `albumName`) alongside `cleanName` — don't attempt fuzzy-matching the raw YouTube title against Spotify directly, the noise is too high. Requires `SPOTIFY_CLIENT_ID` + `SPOTIFY_CLIENT_SECRET` (client credentials, no user auth).
- **VGMDB** — structured game music data with accurate track names, album structure, and composer credits. Primary value is `cleanName` accuracy and `composer`/`franchise` identity tags. Same LLM-as-bridge approach as Spotify: the tagger outputs a structured search query for VGMDB rather than attempting direct title matching. No official API; options are MusicBrainz cross-references or a community JSON dump.

- **Track identity architecture** _(long-term)_ — enrichment is currently keyed to `video_id`, not to the piece of music. Two different YouTube uploads of "Zanarkand" are two separate rows with no shared enrichment. When a user changes a game's playlist link, or the same track appears in a different upload, all Spotify/VGMDB enrichment is lost. The fix is decoupling music identity from video identity: a `music_tracks` table (`cleanName + gameId`, or a MusicBrainz/VGMDB ID) holds all enriched metadata, with one or more `video_id` rows pointing to it. `cleanName` produced by the tagger becomes the stable match key across uploads. This is a schema split, not a column addition — design carefully before implementing.

- **On-the-fly discovery (account tier only)** — when an account user adds a game not in the backfill, YouTube discovery and LLM tagging run during the first generation as they do today. Enrichment (Spotify, VGMDB) should then run asynchronously in the background so it's available on the second generation without blocking the first. Free users cannot trigger on-the-fly discovery — games not in the backfill show a "not in our library" state. Custom playlist overrides are also account-only for the same reason: the new playlist's tracks need LLM tagging before the Director can use them.

**Target schema:**

```sql
ALTER TABLE track_tags ADD COLUMN duration_seconds INTEGER;
ALTER TABLE track_tags ADD COLUMN bpm REAL;
ALTER TABLE track_tags ADD COLUMN valence REAL;           -- 0–1
ALTER TABLE track_tags ADD COLUMN acousticness REAL;      -- 0–1
ALTER TABLE track_tags ADD COLUMN danceability REAL;      -- 0–1
ALTER TABLE track_tags ADD COLUMN spotify_energy REAL;    -- 0–1
ALTER TABLE track_tags ADD COLUMN composer TEXT;
ALTER TABLE track_tags ADD COLUMN franchise TEXT;
ALTER TABLE track_tags ADD COLUMN game_genre TEXT;
ALTER TABLE track_tags ADD COLUMN moods TEXT;             -- JSON array
ALTER TABLE track_tags ADD COLUMN instrumentation TEXT;   -- JSON array
ALTER TABLE track_tags ADD COLUMN in_game_context TEXT;
ALTER TABLE track_tags ADD COLUMN metadata_source TEXT DEFAULT 'llm';
-- metadata_source: 'llm' | 'spotify' | 'youtube_tags' | 'vgmdb' | 'seed'
-- Note: schema above applies to current video_id-keyed model.
-- Track identity architecture (above) will require a separate music_tracks table.
```

## YouTube

- **Quota indicator** — show estimated daily quota remaining or a warning at generation start.
- **YouTube sync rethink** — sync was designed for single-user mode; anonymous cookie-based sessions make OAuth linkage ephemeral and need a new UX model.

## Quality of Life

- **Keyboard shortcuts** — Space (play/pause), ←/→ (previous/next), `m` (mute); `?` shows a cheat-sheet.
- **State retention** - Remeber the state of the user between usages, for example if the app was closed while track 17 was playing, on re-entry, track 17 should be selected.
- **Mobile layout** — responsive pass for the feed and player bar.
- **PWA install** — web app manifest + service worker for home screen install; pairs with mobile layout.
- **Quick-add suggestions** — suggest related titles to add based on active library (Steam "players also play" or genre tags).
- **Legal footer** — LICENSE, attribution, and privacy notice.

## Stats & Insights

A `/stats` page from data already in the DB — no new tracking needed:

- **Games breakdown** — appearance frequency and average track contribution per game across sessions.
- **Total listening time** — cumulative runtime across saved sessions.
- **Reroll & error heatmap** — most-rerolled and stuck-in-error tracks; surfaces poor LLM coverage or YouTube gaps per game.
- **Track status trends** — found/pending/error rates per session over time.

## Admin & Developer

- **Admin dashboard** (`/admin`) — password-protected; YouTube quota and reset countdown, active session count, disk usage, manual purge controls, error logs.
- **Health endpoint** — `GET /api/health` returning DB status, Ollama connectivity, and YouTube API key validity.

## Launch Readiness

- **Free/account split implementation** — wire the tier model: localStorage data layer for free users, backend for account users, Google OAuth login, capability gating in the pipeline (no LLM for free). Backfill must be ready before this ships.
- **Account session expiry** — cleanup job (CRON or on-startup sweep) to delete accounts inactive for >30 days.
- **Session data export** — let account users download their library + config as a JSON bundle.
- **Self-host documentation** — `GETTING_STARTED.md` covering YouTube API key setup, Ollama (local dev), Anthropic API key, env config, and first-run troubleshooting.
- **Live demo deployment** — host a public instance.

## Tier Model

Two tiers at launch. The tier system is capabilities-based — a tier declares what it can do, not which model or provider it uses. This keeps the design extensible to additional tiers without structural changes. Bard/Maestro are dev/config labels; they don't map 1:1 to tiers in production.

**Free (no account)**

- No login, zero friction to start.
- All user data (library, playlists, session history) stored in localStorage — intentionally ephemeral. Clearing browser storage ends the session, the same as logging out. Users who want persistence create an account.
- No LLM — curation runs on backfill seed tags only. The Director assembles the arc using pre-tagged tracks; no tagging calls, no Vibe Check.
- Only games covered by the backfill are available. Untagged games show a clear "not in our library" state rather than silently failing.
- Hard limits enforced before writing to localStorage: max 50 games, max 3 sessions. `QuotaExceededError` handled gracefully (prune oldest session and retry). At these limits the data footprint stays well under 200KB — the 5MB ceiling is not a concern in practice.
- Generation rate limited client-side (localStorage timestamp) as a UX convenience, but the real enforcement is IP-based rate limiting on `/api/playlist/generate` for unauthenticated requests — localStorage can be trivially bypassed via incognito or scripting.

**Account**

- Login required (Google OAuth).
- Full backend storage: games, playlists, session history.
- LLM-powered: tagging for any game, Vibe Check for personalization.
- Any game supported, not just backfill.

**Implementation notes**

- **Capabilities enum over model enum** — `UserTier` should map to a capability set (LLM tagging on/off, Vibe Check on/off, backend storage on/off, session limit) rather than a specific provider. Provider selection (which Claude model, which Ollama model) is a config concern, not a tier concern.
- **Tier toggle is dev-only** — the current Bard/Maestro toggle in the UI must never ship publicly; it exists to test the LLM path locally.
- **Ollama stays local** — Ollama is a dev tool for testing the LLM pipeline without burning Anthropic quota. It's not a production provider for any tier.

## Backfill

Pre-tag 200+ popular game OSTs and ship as seed data (`data/track-tags.json`), following the existing `syncYtPlaylistSeeds` pattern. Seed tags are loaded into `track_tags` on startup.

This is a **prerequisite for the free tier** — without sufficient backfill coverage, the free tier has no content and is an empty product. It's also an independent improvement for account users: covered games skip LLM tagging entirely on first generation.

Backfill quality matters more than quantity. 50 well-tagged games with accurate energy/role/cleanName produces a better experience than 500 games with coarse tags. Priority: high-playtime games, diverse genres (JRPG, action, platformer, FPS, indie), iconic OSTs users are likely to already have in mind.

- **Backfill curation** — select and tag the initial 200+ game corpus; validate energy/role distribution per game before shipping.
- **Backfill update process** — define how the seed file is maintained and expanded over time; community contributions or a periodic re-tag pass.
- **Coverage indicator** — surface in the UI which games in a user's free-tier library are covered vs. not, so they know what will generate successfully.

## Abuse Prevention

- **Free tier IP rate limiting** — IP-based rate limit on `/api/playlist/generate` for unauthenticated requests; client-side localStorage timestamp is a UX convenience only and trivially bypassed. Not perfect (shared NAT, VPNs) but raises the bar from trivial to deliberate abuse.
- **YouTube quota budgets** — per-account daily limits; reject requests once exceeded.
- **LLM token budgets** — cap tokens per generation to prevent runaway costs on account tier.
- **Storage quota** — per-account backend storage limit; archive old playlists instead of deleting.
- **Input sanitization** — sanitize game titles, session names, and search queries against injection beyond current length constraints.
- **Active games cap** — hard limit on games contributing to a single generation (e.g. 50); prevents LLM prompt explosion and YouTube API spam.
- **Usage logging** — track generation count, quota spend, and error rates per account.
- **Abuse detection** — flag accounts exceeding thresholds (e.g. 10+ generations/hour).
