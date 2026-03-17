# BGMancer Features

## Your game library

Your library lives on the **Library** page. The main feed is just for listening — no clutter.

### Adding games

Start typing a game title and an autocomplete dropdown suggests matches from Steam, with cover art. Pick one to link it properly, or type anything freely — BGMancer works with games that aren't on Steam too.

### Steam import

Paste your Steam profile URL and click **Find Library**. BGMancer pulls your public collection, sorted by hours played.

- A **minimum playtime filter** (default: 10 hours) cuts out demos and games you barely touched
- Imported games start **skipped** — they won't appear in playlists until you activate them, so you can cherry-pick instead of flooding your playlist with 400 games at once

### Curation modes

Each game has four modes, controlled by the **Skip / Lite / Include / Focus** buttons on its row:

- **Skip** — excluded from all playlists entirely
- **Lite** — enters curation with a smaller candidate pool; occasional representation
- **Include** — standard (the default for manually added games); normal representation
- **Focus** — guaranteed tracks in every playlist; bypasses the AI selection phase and always contributes its fair share

**Include all shown** activates every skipped game currently visible in your filtered view with one click. Useful after Steam import.

### Filtering and searching

Filter by curation mode: **All**, **Focus**, **Include**, **Lite**, **Skip**. Sort by playtime, name, or date added. Search by title. Page size adjustable (15 / 25 / 50 / 100 per page).

### YouTube playlist override

Each game row shows its discovered YouTube OST playlist — or "Will discover on next run" if not yet cached. Hover the row and click **Set manually** to pin a specific playlist URL or ID. This overrides automatic discovery for your library only.

---

## Generating a playlist

The left panel on the main feed is where you set things up before hitting generate.

### How many tracks

Pick **25**, **50**, or **100** from the preset buttons, or hit **Custom** to type any number up to 150.

### Options

- **Long tracks** — off by default. When off, any track longer than 9 minutes is excluded from the playlist. This keeps OST medleys and extended suites out of a focused listening session. Turn it on if you want the full experience including those longer pieces.

Regardless of this setting, tracks shorter than 90 seconds are always filtered out — title cards, stingers, and menu jingles aren't worth a playlist slot.

- **Short tracks** — on by default. When off, tracks shorter than 90 seconds are filtered (see above). Usually left on.

### How it works

Hit **Curate N Tracks** and watch a live progress panel as BGMancer works through your games. Behind the scenes it runs in three phases:

1. **Discover & Tag** — for each game, find the YouTube OST playlist (cached or auto-discovered). Enrich all tracks with metadata tags: `energy` (1–3), `role` (Opener, Combat, Ambient, etc.), `moods`, `instrumentation`.
2. **Score with Vibe** — (Maestro tier only) an LLM produces a session-level scoring rubric based on your library mix. Used to personalize track selection.
3. **Assemble Arc** — pure TypeScript Director builds the final ordered playlist. Respects energy arc (intro → peak → outro), mixes games proportionally by curation weight, applies the vibe rubric, introduces weighted randomness so regenerations feel fresh.

Because the Director uses weighted random selection (not greedy), regenerating the same games produces genuinely different playlists each time while respecting the arc constraints.

Tracks that couldn't be matched automatically are marked **pending** — hit **Find Videos** to search YouTube for them by name.

### Generation cooldown

After each generation there's a 30-second cooldown before you can run another. The button shows a rotating quip while it recharges.

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

**Seekbar** — the thin bar at the very top of the player spans the full width. Drag it to jump anywhere in the current track.

The player shows your position as **N / Total** to the left of the album art, so you always know where you are in the session.

**Dim** drops the volume to 20% with one click — handy when someone walks in. Click again to restore.

**Up Next** shows the title and game of the following track.

While a track plays, an animated equalizer appears on its row, and a pulsing dot in the generate panel shows which game is currently playing.

Each track row has a direct link to open the video on YouTube.

**Minimize** — the chevron at the right edge of the player collapses it to a thin bar when you want to focus on the library. Click it again to expand.

---

## Rerolling a track

Hover any track row to reveal a **reroll** button. This replaces the track with a different one from the same game's OST playlist — useful when a track doesn't fit the mood or you've heard it too many times.

Rerolled tracks respect your current **Long tracks** and **Short tracks** settings, so you get a replacement that matches your listening preferences.

---

## Reordering tracks

Drag any track row by its handle to reorder the playlist. The new order is saved immediately.

---

## Playlist stats

The sub-row below the session title shows: total tracks · tracks ready · **total runtime** (highlighted in orange) · pending · errors.

---

## Removing tracks

Hover any track row to reveal a remove button (×) on the right. Clicking it immediately removes the track and shows an **Undo** toast at the bottom of the screen. You have 4 seconds to undo before the deletion is committed. If you remove another track while the window is open, the previous deletion commits immediately and a new undo window starts.

---

## Sync to YouTube

Sign in with Google and hit **Sync to YouTube** to push your playlist to a _BGMancer Journey_ playlist on your YouTube account.

---

## Anti-Spoiler Mode

Toggle **Spoilers** in the playlist action bar to blur every track you haven't played yet.

OST titles are notorious spoilers — _The Fate of Aerith_, _Burning Hometown_, _You Died_. With Anti-Spoiler Mode on:

- Track thumbnails are blurred (a soft zoom blur, not a black box)
- Track titles are blurred in place — still there, just unreadable
- Game names are blurred — so even the source game is hidden until you play it
- Channel names are hidden entirely
- The moment you hit **Play**, the track fully reveals itself — in the playlist row and in the player bar

Toggle it off at any time to see the full list. Turning it on mid-session only hides tracks you haven't reached yet. Your preference is remembered between sessions.

---

## Starting over

**Delete** in the playlist sub-row opens a confirmation step. Hover either button to see a tooltip — the confirmation button makes clear the action is permanent and cannot be undone.
