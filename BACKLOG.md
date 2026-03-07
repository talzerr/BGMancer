# What's Coming

## Player

- **Seekbar** — click or drag to jump anywhere in the current track, with elapsed/total time shown
- **Volume control** — slider or mute toggle
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
