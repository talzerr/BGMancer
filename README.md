# BGMancer

An AI-powered video game music curator. Add the games you love, pick a vibe, and BGMancer builds you a YouTube playlist of the best official soundtracks — automatically.

---

## How it works

1. **Add games** to your library and choose a vibe for each — *Official Soundtrack*, *Boss Themes*, or *Ambient & Exploration*
2. **Generate Playlist** — BGMancer finds the official OST playlist for each game on YouTube, then uses a local AI model to pick the best tracks for your vibe
3. **Play in the app** — a built-in player lets you listen without leaving the page; click a playing track to pause, animated waves show what's playing
4. **Sync to YouTube** *(optional)* — sign in with Google to push the playlist to your YouTube account

---

## Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack) |
| Styling | Tailwind CSS 4 |
| Database | MySQL (Docker) |
| AI | Ollama (`llama3.2`) — runs locally |
| Music source | YouTube Data API v3 |
| Auth / sync | NextAuth v5 + Google OAuth |

---

## Running locally

```bash
# 1. Start MySQL
docker compose up -d

# 2. Start Ollama
ollama serve

# 3. Install dependencies and run
npm install
npm run dev        # → http://localhost:6959
```

Copy `.env.local.example` to `.env.local` and fill in your YouTube API key. Google OAuth credentials are optional — only needed for the Sync to YouTube feature.

---

## Project files

| File | Purpose |
|---|---|
| `FEATURES.md` | What the app can do right now |
| `BACKLOG.md` | Planned features and ideas |
| `LEGAL.md` | Disclaimers and third-party terms |
