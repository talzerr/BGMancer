# BGMancer

[![CI](https://github.com/talzerr/bgmancer/actions/workflows/ci.yml/badge.svg)](https://github.com/talzerr/bgmancer/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

An AI-powered playlist curator for video game soundtracks. Add games from your library, hit generate, and BGMancer searches YouTube for each game's OST, filters the tracks with an LLM, then assembles a single cohesive playlist ordered for listening — not just randomly shuffled.

Uses [Anthropic Claude](https://anthropic.com) as the LLM backend. YouTube playback and optional sync to your YouTube account via Google OAuth.

**Live:** [bgmancer.com](https://bgmancer.com) | **Discord:** talzxc

## Running locally

**Requirements:** Node.js >= 22, pnpm

```bash
git clone https://github.com/talzerr/bgmancer.git
cd bgmancer
pnpm install
cp .env.local.example .env.local
```

Fill in `.env.local`:

```env
NEXTAUTH_SECRET=          # openssl rand -base64 32
YOUTUBE_API_KEY=          # console.cloud.google.com
ANTHROPIC_API_KEY=        # console.anthropic.com

# Optional
# STEAM_API_KEY=          # steamcommunity.com/dev/apikey (admin game import)
# GOOGLE_CLIENT_ID=       # Google OAuth (production only)
# GOOGLE_CLIENT_SECRET=
```

```bash
pnpm db:migrate   # apply database migrations
pnpm dev           # → http://localhost:6959
```

See [CLAUDE.md](CLAUDE.md) for full architecture docs, commands, and deployment guide.

## Built with

- **Frontend:** Next.js 16, React, Tailwind CSS
- **Backend:** Cloudflare Workers, D1 (SQLite), KV
- **AI:** Anthropic Claude (track tagging + vibe profiling)
- **APIs:** YouTube Data v3, Steam Web API, Discogs
- **Adapter:** @opennextjs/cloudflare
- **Development:** human-led architecture & decisions, Claude-assisted implementation

## Docs

- [BACKLOG.md](BACKLOG.md) — what's coming next
- [LEGAL.md](LEGAL.md) — disclaimers, privacy, and third-party terms
- [CONTRIBUTING.md](CONTRIBUTING.md) — how to contribute
- [SECURITY.md](SECURITY.md) — vulnerability reporting
- [LICENSE](LICENSE) — MIT License

## License

BGMancer is licensed under the **[MIT License](LICENSE)**.

**Trademark:** The BGMancer name is a trademark of Tal Koviazin. The MIT license covers the code only — it does not grant rights to use the BGMancer name.
