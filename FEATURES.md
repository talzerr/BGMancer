# BGMancer Features

## Your game library

Your library lives on the **Library** page. The main feed is just for listening — no clutter.

### Adding games

Start typing a game title and an autocomplete dropdown suggests matches from Steam, with cover art. Pick one to link it properly, or type anything freely — BGMancer works with games that aren't on Steam too.

### Steam import

Paste your Steam profile URL and click **Find Library**. BGMancer pulls your public collection, sorted by hours played.

- A **minimum playtime filter** (default: 10 hours) cuts out demos and games you barely touched
- Imported games start **disabled** — they won't appear in playlists until you turn them on, so you can cherry-pick instead of flooding your playlist with 400 games at once

### Enabling games

Every game has an on/off toggle. Only enabled games contribute to the playlist. If things feel stale, toggle a few games in or out and regenerate.

**Enable all shown** activates every game currently visible in your filtered view with one click.

### Filtering and searching

Switch between **All**, **Active**, and **Disabled** views. Sort by playtime, name, or date added. Search by title.

---

## Generating a playlist

The left panel on the main feed is where you set things up before hitting generate.

### How many tracks

Pick **25**, **50**, or **100** from the preset buttons, or hit **Custom** to type any number up to 200.

### Options

- **Long tracks** — off by default. When off, any track longer than 10 minutes is excluded from the playlist. This keeps OST medleys and extended suites out of a focused listening session. Turn it on if you want the full experience including those longer pieces.

### How it works

Hit **Curate N Tracks** and watch a live progress panel as BGMancer works through your games. Behind the scenes it runs in three passes:

1. **Find the OST** — for each game, BGMancer looks up (or pulls from cache) the official YouTube OST playlist
2. **Pick candidates** — an AI filters each game's playlist, removing filler and picking a diverse shortlist of roughly 3× your target count
3. **Build the playlist** — a second AI pass looks across all games' shortlists and assembles the final ordered playlist, mixing games, varying energy, and shaping an arc from start to finish

Because the candidate pools are shuffled before the AI sees them, regenerating the same games gives you a genuinely different playlist each time.

Tracks that couldn't be matched automatically are marked **pending** — hit **Find Missing** to run another search pass on them.

### Session history

Every time you hit **Curate** or import a playlist, BGMancer saves it as a named session rather than overwriting what you had. Up to 3 sessions are kept; the oldest is automatically removed when a fourth is created.

Sessions appear in the left sidebar. Click one to switch to it — full interaction is available on any session, not just the current one. The active session is highlighted with a teal dot.

**Renaming:** click the session title at the top of the playlist panel (it highlights on hover) and type a new name. Up to 60 characters.

**Deleting a session:** click **Delete** in the sub-row below the title and confirm. This permanently removes the session and all its tracks.

### Import instead of generating

Already have a YouTube playlist you like? Paste any public YouTube playlist URL into the import field and it loads instantly — no generation needed.

---

## Listening

Click anywhere on a track row to start playback. The player bar appears at the bottom and **stays there as you navigate** — switching to the Library and back doesn't interrupt the music.

**Controls:** Previous · Play/Pause · Next · time display · shuffle · volume slider

The player shows your position as **N / Total** to the left of the album art, so you always know where you are in the session.

**Dim** drops the volume to 20% with one click — handy when someone walks in. Click again to restore.

**Up Next** shows the title of the following track.

While a track plays, an animated equalizer appears on its row, and a pulsing dot in the generate panel shows which game is currently playing.

Each track row has a direct link to open the video on YouTube.

---

## Playlist stats

The sub-row below the session title shows: total tracks · tracks ready · **total runtime** (highlighted in orange) · pending · errors.

---

## Sync to YouTube

Sign in with Google and hit **Sync to YouTube** to push your playlist to a _BGMancer Journey_ playlist on your YouTube account.

---

## Anti-Spoiler Mode

Toggle **Spoilers** in the playlist action bar to blur every track you haven't played yet.

OST titles are notorious spoilers — _The Fate of Aerith_, _Burning Hometown_, _You Died_. With Anti-Spoiler Mode on:

- Track thumbnails are blurred (a soft zoom blur, not a black box)
- Titles are blurred in place — still there, just unreadable
- Channel names are hidden entirely
- The moment you hit **Play**, the track fully reveals itself

Toggle it off at any time to see the full list. Turning it on mid-session only hides tracks you haven't reached yet. Your preference is remembered between sessions.

---

## Removing tracks

Hover any track row to reveal a remove button (×) on the right. Clicking it immediately removes the track and shows an **Undo** toast at the bottom of the screen. You have 4 seconds to undo before the deletion is committed. If you remove another track while the window is open, the previous deletion commits immediately and a new undo window starts.

## Starting over

**Delete** in the playlist sub-row asks for confirmation before permanently removing the session and all its tracks.
