# What's Coming

## Player

- **Seekbar** — click or drag to jump anywhere in the current track
- **Track rating** — Thumbs Up / Thumbs Down while a track plays: thumbs up marks it as a keeper, thumbs down removes it and nudges the AI away from similar picks next time
- **Chapter markers for Full OST videos** — when a long compilation is playing, show timestamp notches on the seekbar; hover to see the chapter name, click to jump there
- **Repeat modes** — off / repeat all / repeat one
- **Mini video view** — expand the player to show the actual YouTube video

## Playlist

- **Per-track remove** — remove a single track you don't like without clearing the whole playlist
- **Per-track reroll** — swap out a single track for a fresh AI pick without regenerating everything
- **Weighted distribution** — give a favourite game more track slots than others
- **Drag to reorder** — manually rearrange the track list before syncing to YouTube
- **Playlist seed export/import** — encode the current playlist as a compact base64 string (each entry is a YouTube video ID + game name, nothing else) and surface a share button next to the playlist stats; pasting a valid seed into an import field recreates the exact same playlist instantly, no generation needed. Useful for sharing a great session with a friend or bookmarking a favourite run.

## Library

- **Playlist cache refresh** — a button per game to force BGMancer to re-discover its YouTube playlist (useful when an OST upload gets taken down or replaced)
- **Bulk text import** — paste a list of game titles to add multiple games at once

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
