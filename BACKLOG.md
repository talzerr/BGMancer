# What's Coming

## Player

- **Seekbar** — click or drag to jump anywhere in the current track
- **Repeat modes** — off / repeat all / repeat one
- **Mini video view** — expand the player to show the actual YouTube video
- **Chapter markers for Full OST videos** — when a long compilation is playing, parse the YouTube description for timestamps and render notches on the seekbar; hover to see the chapter name, click to jump there

## Playlist

- **Track rating** — Thumbs Up / Thumbs Down while a track plays; liked/disliked video IDs are stored and injected into the Phase 3 curation prompt as explicit keep/avoid hints on the next run
- **Playlist seed export/import** — encode the current playlist as a compact string (video ID + game name per entry) and surface a share button; pasting a valid seed recreates the exact playlist instantly, no generation needed

## Library

- **Playlist cache refresh** — a button per game to force BGMancer to re-discover its YouTube playlist (useful when an OST upload gets taken down or replaced)
- **Bulk text import** — paste a list of game titles to add multiple games at once
- **"The Essentials" empty state** — when the library is empty, show a curated starter set (e.g. Chrono Trigger, Halo, Doom, Persona 5) as one-click adds; a first-time user should hear music within 3 clicks

## Curation Intelligence

- **Curation mood hint** — a free-text field on the generate panel (e.g. "focus session", "driving late at night", "boss rush energy") that gets appended to the Phase 3 system prompt. Replaces the old rigid vibe enum with something open-ended, stored as a single `curation_hint` config value
- **Cross-session uniqueness** — when generating a new session, bias against tracks that already appear in recent sessions so consecutive runs feel genuinely different
- **Playlist preview before commit** — after Phase 3 returns, surface the ordered track list for review before saving; allow swapping or removing individual tracks in that moment
- **Game priority hints** — mark a game as high/low priority, injected as a soft hint into the Phase 3 prompt ("favour more tracks from X", "keep Y minimal")
- **MusicBrainz enrichment** — enrich track metadata (artist, mood tags) from MusicBrainz after each generation and cache it in `mb_track_cache`; feed cached tags into Phase 2 and Phase 3 prompts as structured energy/mood signal. Low hit-rate on game OSTs (~29% tags, ~55% artist in early testing) means it's a hint, not a hard requirement. Implementation was scaffolded but removed pending better coverage or an alternative metadata source

## Full OST mode

Re-expose the per-game toggle that makes BGMancer find a single long compilation video for a game instead of individual tracks. The underlying pipeline logic is already in place — it just needs to surface in the UI again.

## YouTube

- **YouTube quota indicator** — show estimated daily quota remaining or surface a warning at generation start; the hard quota limit is a real source of pain when generating often
- **Sync to an existing playlist** — push to a YouTube playlist you already own instead of always creating a new one
- **Multiple playlists** — maintain separate playlists for different moods or sessions
- **Rework playlist import** — the current importer accepts a raw YouTube playlist URL and pulls all videos in as tracks, bypassing the AI pipeline entirely; this should be revisited: consider running imported tracks through Phase 3 curation for ordering, inferring game titles from video metadata so tracks land in the right library games, validating that videos are actually game OST content, and giving the user a preview before committing the import

## Quality of Life

- **Mobile install** — add BGMancer to your home screen as a PWA
- **Quick-Add suggestions** — based on your active games, show recommended games to add with one click
- **Keyboard shortcuts** — space to play/pause, ← / → for previous/next, `m` to mute/dim; show a shortcuts cheat-sheet on `?`
- **Player memory** — persist the last-used player state, including track playing, location and voltime

## Stats & Insights

A `/stats` page surfacing data already captured in the DB — no new tracking needed:

- **Games breakdown** — which games appear most often across your sessions, and how many tracks each contributed on average
- **Total listening time** — cumulative runtime across all saved sessions
- **Reroll & error heatmap** — tracks most frequently rerolled or stuck in error state; surfaces games the LLM consistently misjudges or YouTube has poor coverage for
- **Track status trends** — found vs. pending vs. error rates per session over time, useful for diagnosing YouTube quota pressure

## New Pages

- **`/share/[seed]`** — a landing page for shared playlists. Depends on the playlist seed export/import feature (see Playlist section above); a visitor who follows a share link sees a read-only playlist view and can clone it into their own library with one click

## Hosting

- **Anonymous multi-user sessions** — issue each visitor a UUID cookie and route all DB reads/writes to a dedicated per-session SQLite file (`data/sessions/{uuid}.db`). Sessions expire after 30 days of inactivity. No sign-in required; data is silently scoped per browser. The repo layer stays unchanged via `AsyncLocalStorage` — only the DB init and API route wrappers need updating
- **Session data export** — let a user download their full library + config as a JSON bundle to back up or migrate before their session expires
- **Optional Google sign-in for persistence** — link an anonymous session to a Google account so the library survives cookie clears and works across devices
- **Admin dashboard** — a password-protected `/admin` route showing active session count, disk usage per session, and a manual purge button
- **Rate limiting** — per-session limits on generation requests and YouTube API calls to prevent quota exhaustion
