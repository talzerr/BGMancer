# What's Coming

## Player

- **Seekbar** — click or drag to jump anywhere in the current track
- **Track rating** — Thumbs Up / Thumbs Down while a track plays: thumbs up marks it as a keeper, thumbs down removes it and nudges the AI away from similar picks next time
- **Chapter markers for Full OST videos** — when a long compilation is playing, parse the YouTube description for timestamps and render notches on the seekbar; hover to see the chapter name, click to jump there. This effectively beats the YouTube UI at its own game for long compilations.
- **Repeat modes** — off / repeat all / repeat one
- **Mini video view** — expand the player to show the actual YouTube video
- **Vibe-coded equalizer bars** — the animated equalizer bars on the active track row take on colors that match the current vibe: red/orange for Boss Themes, slow-pulsing blue/teal for Ambient & Exploration, etc. Color reinforces the mood at a glance.

## Playlist

- **Per-track remove** — remove a single track you don't like without clearing the whole playlist
- **Per-track reroll** — a small refresh icon on each track row that tells the AI "keep the game and vibe, just give me a different track" — no need to regenerate the whole 50-track list
- **Weighted distribution** — give a favourite game more track slots than others
- **Drag to reorder** — manually rearrange the track list before syncing to YouTube
- **Playlist seed export/import** — encode the current playlist as a compact base64 string (each entry is a YouTube video ID + game name, nothing else) and surface a share button next to the playlist stats; pasting a valid seed into an import field recreates the exact same playlist instantly, no generation needed. Useful for sharing a great session with a friend or bookmarking a favourite run.

## Library

- **Playlist cache refresh** — a button per game to force BGMancer to re-discover its YouTube playlist (useful when an OST upload gets taken down or replaced)
- **Bulk text import** — paste a list of game titles to add multiple games at once
- **"The Essentials" empty state** — when the library is empty, show a curated starter set (e.g. Chrono Trigger, Halo, Doom, Persona 5) as one-click adds. A first-time user should be able to hear music within 3 clicks of opening the app.

## Full OST mode

Re-expose the per-game toggle that makes BGMancer find a single long compilation video for a game instead of individual tracks. The underlying pipeline logic is already in place — it just needs to surface in the UI again.

## Vibe

- **Per-game vibe override** — let individual games deviate from the global playlist vibe when the global mood doesn't fit that game's soundtrack
- **Vibe blending** — automatically alternate between high-energy and chill tracks across the playlist for a more dynamic session

## YouTube

- **Sync to an existing playlist** — push to a YouTube playlist you already own instead of always creating a new one
- **Multiple playlists** — maintain separate playlists for different moods

## Quality of Life

- **Mobile install** — add BGMancer to your home screen as a PWA
- **Quick-Add suggestions** — based on your active games, show recommended games to add with one click

## Hosting

- **Anonymous multi-user sessions** — issue each visitor a UUID cookie and route all DB reads/writes to a dedicated per-session SQLite file (`data/sessions/{uuid}.db`). Sessions expire after 30 days of inactivity and are cleaned up on server start. No sign-in required; data is silently scoped per browser. The repo layer stays unchanged via `AsyncLocalStorage` — only the DB init and the API route wrappers need updating.
- **Session data export** — let a user download their full library + config as a JSON bundle so they can back it up or migrate to a new browser/device before their session expires
- **Optional Google sign-in for persistence** — allow a user to link their anonymous session to a Google account so their library survives cookie clears and works across devices; merges with any existing session data for that account
- **Admin dashboard** — a password-protected `/admin` route showing active session count, disk usage per session, and a manual "purge old sessions" button for the server owner
- **Rate limiting** — per-session limits on generation requests and YouTube API calls to prevent a single user from exhausting the server's API quota
- **Metrics (Prometheus)** — expose a `/metrics` endpoint via `prom-client` tracking request latency, error rates, active sessions, and YouTube quota consumption; scrape with a Prometheus sidecar and visualise in Grafana
- **Structured logging (Elastic)** — ship structured JSON logs to Elasticsearch via Filebeat or the Elastic APM Node agent; index per-session activity and API errors for full-text search and alerting in Kibana
