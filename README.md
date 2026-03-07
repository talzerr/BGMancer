# BGMancer

An AI-powered video game music curator. Add the games you love, pick a vibe, and BGMancer builds you a YouTube playlist of the best official soundtracks — automatically.

---

## How it works

1. **Add games** to your library and choose a vibe for each — *Official Soundtrack*, *Boss Themes*, or *Ambient & Exploration*
2. **Pick a size** — choose how many tracks to generate (25 / 50 / 100, or any custom number)
3. **Generate Playlist** — a live progress panel shows BGMancer finding each game's OST on YouTube, then using a local AI model to pick the best tracks for your vibe
4. **Play in the app** — sticky player with elapsed/duration, shuffle, volume slider, dim toggle, and Up Next preview
5. **Sync to YouTube** *(optional)* — sign in with Google to push the playlist to your YouTube account

> **Quota tip:** If your YouTube API quota is exhausted, paste any YouTube playlist URL directly into the import form in the empty state to load tracks with a single low-cost API call.

---

## Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack) |
| Styling | Tailwind CSS 4 |
| Database | SQLite (file-based, zero setup) |
| AI | Ollama (`llama3.2`) — runs locally |
| Music source | YouTube Data API v3 |
| Auth / sync | NextAuth v5 + Google OAuth |

---

## Running locally

```bash
# 1. Start Ollama
ollama serve

# 2. Install dependencies and run
npm install
npm run dev        # → http://localhost:6959
```

Copy `.env.local.example` to `.env.local` and fill in your YouTube API key. The SQLite database (`bgmancer.db`) is created automatically in the project root on first run — no Docker, no database setup required.

Google OAuth credentials are optional — only needed for the Sync to YouTube feature.

---

## Project structure

```
src/
  app/
    feed-client.tsx       # Root client component — thin coordinator
    api/                  # Next.js route handlers (games, playlist, config, sync)
  components/
    PlayerBar.tsx         # Sticky bottom player (YouTube IFrame API)
    GameCard.tsx          # Library game row with Full OST toggle
    PlaylistTrackCard.tsx # Playlist row with vibe accent + equalizer waves
    AddGameForm.tsx       # Add game form
    GenerateSection.tsx   # Live SSE progress panel + track count picker
    PlaylistEmptyState.tsx# Empty playlist with YouTube import form
    SyncButton.tsx        # Optional YouTube sync button
  hooks/
    useGameLibrary.ts     # Games state + CRUD
    usePlaylist.ts        # Tracks state + generate / clear / import
    usePlayerState.ts     # Playback index + shuffle + effectiveTracks
    useConfig.ts          # Target track count (persisted to DB)
    useYouTubePlayer.ts   # YouTube IFrame API wiring + volume/time
  lib/
    db.ts                 # SQLite client (better-sqlite3, auto-schema)
    youtube.ts            # YouTube Data API helpers + quota error handling
    llm.ts                # Ollama helpers for track selection
  types/
    index.ts              # Shared TypeScript types
```

---

## Project docs

| File | Purpose |
|---|---|
| `FEATURES.md` | What the app can do right now |
| `BACKLOG.md` | Planned features and ideas |
| `LEGAL.md` | Disclaimers and third-party terms |
