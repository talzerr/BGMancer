# BGMancer

An AI-powered playlist curator for video game soundtracks. Add games from your library, hit generate, and BGMancer searches YouTube for each game's OST, filters the tracks with an LLM, then assembles a single cohesive playlist ordered for listening — not just randomly shuffled.

Supports [Anthropic Claude](https://anthropic.com) (hosted) or [Ollama](https://ollama.com) (local) as the LLM backend. YouTube playback and optional sync to your YouTube account via Google OAuth.

## Running locally

**Requirements:** Node.js ≥ 18, a [YouTube Data API v3 key](https://console.cloud.google.com/), a [Steam API key](https://steamcommunity.com/dev/apikey), and either an Anthropic API key or Ollama running locally.

```bash
git clone https://github.com/talzerr/bgmancer.git
cd bgmancer
npm install
cp .env.local.example .env.local
```

Fill in `.env.local`:

```env
YOUTUBE_API_KEY=
STEAM_API_KEY=
ANTHROPIC_API_KEY=        # or leave blank and use Ollama below
NEXTAUTH_SECRET=          # any random string

# Optional — Ollama instead of (or alongside) Claude
# OLLAMA_HOST=http://localhost:11434
# OLLAMA_MODEL=llama3.2

# Optional — only needed for "Sync to YouTube"
# GOOGLE_CLIENT_ID=
# GOOGLE_CLIENT_SECRET=
```

```bash
npm run dev   # → http://localhost:6959
```

## Built with

- **Frontend:** Next.js 16, React, Tailwind CSS
- **Backend:** Node.js, better-sqlite3, Next.js API routes
- **AI:** Anthropic Claude (hosted) or Ollama (local)
- **APIs:** YouTube Data v3, Steam
- **Development:** human-led architecture & decisions, Claude-assisted implementation

## Docs

- [FEATURES.md](FEATURES.md) — full feature breakdown
- [BACKLOG.md](BACKLOG.md) — what's coming next
- [LEGAL.md](LEGAL.md) — disclaimers and third-party terms
- [LICENSE](LICENSE) — GNU Affero General Public License v3

## License

BGMancer is licensed under the **[GNU Affero General Public License v3.0](LICENSE)** (AGPL-3.0).

Plain-English summary: you can use, modify, and distribute this code, but if you host a modified version publicly (on a server accessible to others), you must make your modified source code available to your users under the same license. This requirement applies to network-accessible deployments, not just distributed binaries.

**Trademark:** The BGMancer™ name and logo are trademarks of Tal Koviazin. The AGPL license covers the code only — it does not grant rights to use the BGMancer™ brand.
