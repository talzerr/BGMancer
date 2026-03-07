# What BGMancer Can Do

## Build your game library

Add any game with a title and a vibe — *Official Soundtrack*, *Boss Themes*, or *Ambient & Exploration*. Toggle **Full OST** on a game if you'd rather have one long compilation video instead of individual tracks. Remove games with an inline confirmation prompt.

## Generate a playlist

Hit **Generate Playlist** and BGMancer does the work:

1. Finds the game's official OST playlist on YouTube
2. Reads the real track list from it
3. Asks the local AI model (Ollama / llama3.2) to pick the best tracks for your chosen vibe
4. Tracks from all your games are interleaved so the playlist stays varied

The default playlist length is 50 tracks, spread equally across your games. Any tracks that couldn't be sourced automatically are flagged as *pending* and can be resolved with the **Find Missing** button.

## Play it in the app

Click any track to start playing. A sticky player bar appears at the bottom with:

- **Prev / Play-Pause / Next** controls
- **Click a playing track to pause it** — click again to resume
- **Animated equalizer waves** replace the track number while a song is playing, freezing when paused
- Auto-advance to the next track when one ends, looping back to the start at the end of the playlist
- Thumbnail preview of the current track
- A **▶ YouTube** button that opens the current video on YouTube

## YouTube attribution

Wherever YouTube thumbnails or track data are shown outside the native player, a **▶ YouTube** badge is displayed to comply with the YouTube API Terms of Service.

## Clear playlist

The **Clear playlist** action requires an inline confirmation (*"Clear all tracks? Yes, clear / Cancel"*) before wiping the current playlist.

## Sync to YouTube

Sign in with Google and hit **Sync to YouTube** to push your found tracks to a *BGMancer Journey* playlist on your YouTube account.

## App icon & branding

Custom-designed app icon used as the browser favicon, Apple touch icon, and in-app header logo. The header also shows placeholder **Connect Steam** and **Connect YouTube** buttons for future integrations.
