# What's Coming

## Player

- **Seekbar** — click or drag to jump anywhere in the current track
- **Track rating** — Thumbs Up / Thumbs Down (or ♥ / 🗑) directly in the player bar while a track plays:
  - *Thumbs Up* → marks the track as a keeper; can influence future generation weighting for that game
  - *Thumbs Down* → removes the track from the current playlist and feeds back to the AI: "avoid this vibe for this game next time" (stored as a per-game preference signal alongside `vibe_preference`)
- **Full-OST chapter markers** — when a long compilation video is playing (Full OST mode), parse the YouTube video description for timestamps and render them as small vertical notches on the seekbar; hovering a notch shows the chapter name (e.g. `05:22 – Tristram Village`), clicking jumps directly to it
- **Repeat modes** — off / repeat all / repeat one
- **Mini video view** — expand the player to show the actual YouTube video

## Playlist

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

- **Steam import** — connect your Steam account and automatically pull in your played games
- **Game autocomplete** — search by title and pull in cover art automatically
- **Bulk import** — add multiple games at once from a text paste

## YouTube

- **Connect YouTube account** — link your YouTube account directly in-app for sync without full Google OAuth
- **Push to existing playlist** — update a YouTube playlist you already own instead of creating a new one each time
- **Better sync** — preserve track order when pushing; skip unavailable videos automatically
- **Multiple playlists** — create separate named playlists (e.g. "Boss Rush", "Chill Gaming")

## Quality of Life

- **Drag to reorder** — manually adjust the track order before syncing
- **Mobile install** — add to your home screen as a PWA
