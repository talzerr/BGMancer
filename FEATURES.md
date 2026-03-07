# What BGMancer Can Do

## Build your game library

Add any game with a title and a vibe — *Official Soundtrack*, *Boss Themes*, or *Ambient & Exploration*. Toggle **Full OST** on a game to prefer long compilation videos over individual tracks. Remove games with an inline confirmation prompt.

## Generate a playlist

Choose how many tracks to generate with the **Tracks** picker (quick presets: 25 / 50 / 100, or type any number up to 200), then hit **Generate**. BGMancer runs a live AI pipeline for each game:

1. Finds the game's official OST playlist on YouTube
2. Reads the real track list from it
3. Asks the local AI model (Ollama / llama3.2) to pick the best tracks for your chosen vibe
4. Tracks from all your games are interleaved so the playlist stays varied

A **live progress panel** replaces the button during generation, showing per-game status (waiting → active → done / error) in real-time via server-sent events. Any tracks that couldn't be sourced automatically are flagged as *pending* and can be resolved with the **Find Missing** button.

## Import a YouTube playlist directly

Paste any YouTube playlist URL into the empty-state import form to bypass the YouTube API search quota. Tracks are loaded in one low-cost `playlistItems.list` call and appear immediately.

## Play it in the app

Click any track to start playing. A sticky player bar appears at the bottom with:

- **Prev / Play-Pause / Next** controls
- **Elapsed / duration display** — `0:42 / 3:58` updates every second while a track plays
- **Shuffle** — Fisher-Yates randomisation; toggling on keeps the current track playing at position 1, toggling off restores the original order; indicated by a violet shuffle icon
- **Volume slider** — independent of system volume, with a **Dim toggle** that instantly drops to 20% (amber indicator) and restores on second click — one tap to stay quiet on a call
- **Up Next preview** — shows the next track's title on wide screens, reducing skip anxiety
- **Click a playing track to pause it** — click again to resume; animated equalizer waves show what's playing
- Auto-advance to the next track when one ends, looping back to start
- Thumbnail preview with YouTube attribution badge
- A **▶ YouTube** button that opens the current video on YouTube
- **Vibe-coded left border accents** on each playlist row — violet for Official Soundtrack, red for Boss Themes, sky for Ambient & Exploration
- **Active game highlight** — the game card in the sidebar pulses when one of its tracks is playing

## Clear playlist

The **Clear playlist** action requires an inline confirmation (*"Clear all tracks? Yes, clear / Cancel"*) before wiping the current playlist.

## YouTube attribution

Wherever YouTube thumbnails or track data are shown outside the native player, a **▶ YouTube** badge is displayed to comply with the YouTube API Terms of Service.

## Sync to YouTube

Sign in with Google and hit **Sync to YouTube** to push your found tracks to a *BGMancer Journey* playlist on your YouTube account.

## Quota-safe generation

YouTube API quota errors are detected immediately, generation stops early with a clear message, and no further quota is consumed. A startup warning is logged if `YOUTUBE_API_KEY` is not set.
