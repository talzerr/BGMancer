# What's Coming

## Player

- **Elapsed / duration display** — show `0:42 / 3:58` next to the player controls so you always know where you are in a track
- **Seekbar** — click or drag to jump anywhere in the current track (builds on the elapsed/duration display above)
- **Volume slider** — independent of system volume (essential for web apps used as background music during gaming or work); pairs with a **Dim / Focus toggle** that instantly drops volume to ~20% — one click to silence BGMancer for a Discord call or conversation without touching the system slider
- **Up Next preview** — show a small "Up Next: [Song Title]" hint on the right side of the player bar so users know whether to stick through the current track or skip; reduces skip anxiety
- **Track rating** — Thumbs Up / Thumbs Down (or ♥ / 🗑) directly in the player bar while a track plays:
  - *Thumbs Up* → marks the track as a keeper; can influence future generation weighting for that game
  - *Thumbs Down* → removes the track from the current playlist and feeds back to the AI: "avoid this vibe for this game next time" (stored as a per-game preference signal alongside `vibe_preference`)
- **Full-OST chapter markers** — when a long compilation video is playing (Full OST mode), parse the YouTube video description for timestamps and render them as small vertical notches on the seekbar; hovering a notch shows the chapter name (e.g. `05:22 – Tristram Village`), clicking jumps directly to it
- **Shuffle** — randomise the play order
- **Repeat modes** — off / repeat all / repeat one
- **Mini video view** — expand the player to show the actual YouTube video

## Playlist

- **Playlist size** — choose how many tracks to generate (e.g. 25, 50, 100) before hitting Generate
- **Per-track retry** — swap out a single bad result without regenerating everything
- **Weighted distribution** — give your favourite game more track slots than others
- **Vibe balancing** — automatically alternate between high-energy and chill tracks
- **Stale video detection** — skip deleted or unavailable videos before syncing

## Smart Empty State

- **Vibe preset one-click seeds** — when no playlist exists, show 3–4 curated preset buttons ("Soulsborne Boss Rush", "JRPG Ambience", "Cosy Exploration") that auto-populate the game library and trigger Generate in one click. The fastest path to the "magic moment" for first-time users.

## Seeds (Shareable Playlists)

A **seed** is a compact, versioned string that encodes a full game library config (titles + vibe + Full OST flags). Anyone with a seed can paste it in and instantly recreate the same setup and hit Generate.

Seed format: `BGM1-<base64url(json)>` — versioned prefix so the schema can evolve.

```json
{ "v": 1, "name": "Soulsborne Boss Rush", "games": [
    { "t": "Elden Ring",    "v": "boss_themes", "f": false },
    { "t": "Bloodborne",    "v": "boss_themes", "f": false },
    { "t": "Hollow Knight", "v": "boss_themes", "f": false }
]}
```

Sub-features:

- **Export seed** — copy seed string to clipboard from current library (single button in Game Library panel)
- **Import seed** — paste a seed string to replace or merge into the current library, then hit Generate
- **Share URL** — `?seed=...` query param that auto-imports on load (no sign-in needed, fully shareable link)
- **Curated presets** — ship a small set of hand-picked seeds ("Soulsborne Boss Rush", "JRPG Ambience", "Retro 8-bit", "Cosy Exploration") as one-click starting points

## Game Library

- **Steam import** — connect your Steam account and automatically pull in your played games (Connect Steam button is already in the header as a placeholder)
- **Game autocomplete** — search by title and pull in cover art automatically
- **Bulk import** — add multiple games at once from a text paste

## YouTube

- **Connect YouTube account** — link your YouTube account directly in-app for sync without full Google OAuth (Connect YouTube button is already in the header as a placeholder)
- **Push to existing playlist** — update a YouTube playlist you already own instead of creating a new one each time
- **Better sync** — preserve track order when pushing; skip unavailable videos automatically
- **Multiple playlists** — create separate named playlists (e.g. "Boss Rush", "Chill Gaming")

## Quality of Life

- **Drag to reorder** — manually adjust the track order before syncing
- **Real-time generation** — watch tracks appear one by one instead of waiting for the full batch
- **Mobile install** — add to your home screen as a PWA
