# What BGMancer Can Do

## Build your game library

Everything related to your games lives on the **Library** page — the main feed stays focused on listening.

The library uses a two-column layout: a left sidebar for adding and importing games, and the main area for browsing and managing your collection.

### Add a game

Type a game title and an autocomplete dropdown suggests matches from Steam, complete with cover art. Select one to link it to its Steam page, or just type freely to add any game — even ones not on Steam.

### Import your Steam library

Paste your Steam profile URL and click **Find Library**. BGMancer pulls your public game collection and shows it sorted by hours played.

- A **minimum playtime filter** (default: 10 hours) hides games you've barely touched, so you're not sorting through hundreds of demos and free weekends.
- Imported games start **disabled** — they're in your library but won't show up in the playlist until you turn them on. This lets you cherry-pick instead of flooding your playlist with 400 games at once.

### Enable and disable games

Every game has an on/off toggle. Only enabled games are included when you generate. If your playlist is feeling stale, flip a few games off and on to shift the mix.

- **Enable all shown** — a single button activates all the games currently visible in your filtered view.

### Filter, sort, and search

The library toolbar lets you jump between **All**, **Active**, and **Disabled** views, sort by when you added games, playtime, or name, and search by title.

---

## Generate a playlist

The left panel on the main feed is your **control center** — a single card with everything you need before hitting generate.

### Playlist Size

Choose from **25 / 50 / 100** preset pill buttons, or click **Custom** to type any number from 1 to 200. The Custom pill transforms into an inline input — no extra box, no layout jump.

### Vibe

Pick the mood that applies to the entire playlist. All tracks across all games will be curated to match it.

| Vibe | What it sounds like |
|---|---|
| **Official Soundtrack** | Iconic highlights — the tracks fans remember most |
| **Boss Themes** | Intense combat and boss battle music |
| **Ambient & Exploration** | Calm, atmospheric world music |
| **Study / Deep Work** | Steady background music with no sudden loud moments |
| **Workout / Hype** | High-energy, driving tracks with strong rhythm |
| **Emotional / Story** | Cinematic, moving, or nostalgic story moments |
| **✦ Surprise Me** | BGMancer picks a random vibe — different every time |

Your last-used vibe is remembered between sessions.

### Curate

Hit **Curate N Tracks**. A live progress panel shows each game moving through the pipeline as BGMancer works — searching YouTube, fetching track lists, and asking the local AI to pick the best fit.

A summary line below the button shows you what you're about to generate: *"7 games · Official Soundtrack vibe · 50 tracks"*

When it's done, tracks from all your games are woven together so the playlist stays varied — you won't hear five tracks from the same game in a row. Each generation draws from a shuffled pool and uses slightly different AI picks, so regenerating with the same games produces a genuinely different playlist.

Any tracks that couldn't be found automatically are marked as **pending**. Hit **Find Missing** to run another search pass on them.

---

## Import from a YouTube playlist

Skip generation entirely by pasting any public YouTube playlist URL into the import form on the empty state. The tracks load instantly using a single API call.

---

## Listen

Click any track to start the player. A bar appears at the bottom of the screen and **stays there while you navigate** — switching to the Library page and back doesn't stop the music.

**Controls:**

- Previous / Play-Pause / Next
- Time display — shows where you are in the current track
- **Shuffle** — randomises the order while keeping whatever's currently playing at the front
- **Volume slider** with a **Dim toggle** — one click drops the volume to 20% (handy when someone walks in), one click brings it back
- **Up Next** — shows the title of the next track so you know what's coming

**While listening:**

- The game library card on the main feed shows a pulsing dot with the name of the game currently playing
- Animated equalizer bars on the active track row
- A direct link to open the current video on YouTube

---

## Playlist stats

Above the track list you'll see: total tracks · how many are ready · the **total runtime** (e.g. `3h 42m`) · how many are still pending · how many errored.

---

## Sync to YouTube

Sign in with Google and hit **Sync to YouTube** to push your playlist to a *BGMancer Journey* playlist on your YouTube account.

---

## Anti-Spoiler Mode

A toggle in the playlist action bar (the **Spoilers** button) that hides track titles and thumbnails for any track you haven't heard yet.

OST titles often reference story moments — *The Fate of Aerith*, *Burning Hometown*, *You Died* — that spoil plot twists before you've reached them in the game. With Anti-Spoiler Mode on, each track's title and artwork is blurred until you play it. The moment you hit play, it reveals itself.

Toggle it off at any time to see the full playlist at once. Your preference is remembered between sessions.

---

## Clear and start over

**Clear playlist** asks for confirmation before wiping everything, so you won't accidentally lose a playlist you like.
