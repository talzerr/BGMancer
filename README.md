# BGMancer

An AI-powered playlist curator for video game soundtracks. Add games from your library, hit generate, and BGMancer searches YouTube for each game's OST, filters the tracks with an LLM, then assembles a single cohesive playlist ordered for listening — not just randomly shuffled.

Uses [Anthropic Claude](https://anthropic.com) as the LLM backend. YouTube playback and optional sync to your YouTube account via Google OAuth.

## Running locally

**Requirements:** Node.js ≥ 22, pnpm, a [YouTube Data API v3 key](https://console.cloud.google.com/), a [Steam API key](https://steamcommunity.com/dev/apikey), and an [Anthropic API key](https://console.anthropic.com).

```bash
git clone https://github.com/talzerr/bgmancer.git
cd bgmancer
pnpm install
cp .env.local.example .env.local
```

Fill in `.env.local`:

```env
YOUTUBE_API_KEY=
STEAM_API_KEY=
ANTHROPIC_API_KEY=
NEXTAUTH_SECRET=          # any random string

# Optional — only needed for "Sync to YouTube"
# GOOGLE_CLIENT_ID=
# GOOGLE_CLIENT_SECRET=
```

```bash
pnpm dev   # → http://localhost:6959
```

## Built with

- **Frontend:** Next.js 16, React, Tailwind CSS
- **Backend:** Node.js, better-sqlite3, Next.js API routes
- **AI:** Anthropic Claude
- **APIs:** YouTube Data v3, Steam
- **Development:** human-led architecture & decisions, Claude-assisted implementation

## Docs

- [FEATURES.md](FEATURES.md) — full feature breakdown
- [BACKLOG.md](BACKLOG.md) — what's coming next
- [LEGAL.md](LEGAL.md) — disclaimers and third-party terms
- [LICENSE](LICENSE) — MIT License

## License

BGMancer is licensed under the **[MIT License](LICENSE)**.

**Trademark:** The BGMancer™ name is a trademark of Tal Koviazin. The MIT license covers the code only — it does not grant rights to use the BGMancer™ name.
