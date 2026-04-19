# BGMancer

[![CI](https://github.com/talzerr/bgmancer/actions/workflows/ci.yml/badge.svg)](https://github.com/talzerr/bgmancer/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Next.js 16](https://img.shields.io/badge/Next.js-16-black)](https://nextjs.org)
[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-F38020)](https://workers.cloudflare.com)
[![TypeScript strict](https://img.shields.io/badge/TypeScript-strict-3178C6)](https://www.typescriptlang.org)

**Playlists from the games you've played.**

Pick your games. Hit curate. BGMancer builds a soundtrack mix shaped like a gaming session — it starts quiet, builds tension, peaks, breathes, and resolves. Tracks stream from YouTube. No audio is hosted, no accounts required to try it.

**→ Live at [bgmancer.com](https://bgmancer.com)**

---

## What makes it interesting

Most "game music playlist" tools are just shuffle with a branded wrapper. BGMancer is built around a deterministic assembly algorithm — **the Director** — that treats playlist order as a constrained optimization problem over a narrative energy arc, not a sampling problem. Every track placement is a scored decision.

The LLM layer (**Vibe Profiler**, powered by Anthropic Claude) writes a personalized rubric for the arc's emotional shape based on the user's specific game selection. The Director then assembles against that rubric with zero probabilistic language-model involvement at assembly time. Deterministic output, stable edits, no hallucinated tracks.

If you want to understand the craft, read [DIRECTOR.md](DIRECTOR.md) — it's the algorithmic spec.

---

## Features

- **Four playlist modes**
  - *Journey* (default) — six-phase narrative arc, Vibe Profiler writes a custom rubric
  - *Chill* — energy 1+2, steady low mood
  - *Mix* — all energies, one steady phase
  - *Rush* — energy 2+3, high-intensity
- **Per-game curation intensity**: `lite` (half weight), `include` (default), `focus` (doubled budget + pre-assigned arc slots)
- **Guest and authenticated flows**
  - Guest: library in localStorage, Director-only generation, no persistence
  - Signed-in: DB-backed library, session history (last 3), full pipeline (Vibe Profiler + Director), reroll, Sync-to-YouTube
- **Steam import** — link your public Steam library as a discovery aid (not auto-import; you pick what stays)
- **Catalog "Request a game"** — gated by Cloudflare Turnstile, backed by IGDB search, pipeline picks it up for curation
- **Backstage admin** — game onboarding (Discogs/VGMdb/manual tracklists → LLM video resolver → LLM tagger), review flags, theatre view for Director decisions, gated by Cloudflare Access

---

## Stack

- **Runtime:** Cloudflare Workers (production + staging) via [`@opennextjs/cloudflare`](https://opennext.js.org/cloudflare). Miniflare for local dev.
- **Frontend:** Next.js 16 App Router, React 19, TypeScript strict, Tailwind 4, shadcn/Radix primitives, all on a custom warm-dark design system (see [DESIGN_SYSTEM.md](docs/claude/DESIGN_SYSTEM.md))
- **Database:** Cloudflare D1 (SQLite at the edge) with Drizzle ORM. Migrations in `drizzle/migrations/`.
- **Auth:** NextAuth v5 (Google OAuth in prod, Credentials provider in dev). Backstage additionally gated by Cloudflare Access.
- **LLM:** Anthropic Claude (track tagging, Vibe Profiler, session naming). Model overrides per use case.
- **External APIs:** YouTube Data v3 (playback + sync), Steam Web API (public library), IGDB via Twitch OAuth (catalog search), Discogs (tracklists)
- **Rate limiting:** KV sliding window for guests, DB-backed atomic generation lock (single `UPDATE...RETURNING`, TOCTOU-safe) for authed users
- **Tests:** Vitest with 100% coverage target on `src/lib/**`, `better-sqlite3` wrapped in a D1-compat layer
- **Bot mitigation:** Cloudflare Turnstile on guest playlist generation and game requests

---

## Engineering notes worth reading

A few things I'm proud of:

- **Route allowlist via middleware** (`src/lib/route-config.ts`) — every accessible route (page or API) must be registered with an `AuthLevel` (Public / Optional / Required / Admin). Unregistered routes return 404 before they reach the handler. One source of truth for auth posture across ~80 routes.
- **Handler-layer auth wrappers** (`withRequiredAuth` / `withOptionalAuth` / `withAdminAuth`) — middleware can't call NextAuth's `auth()` in this setup, so enforcement is defense-in-depth: allowlist + wrapper + ownership check + Zod body validation.
- **Zod at every mutation boundary** (`src/lib/validation.ts`) — every POST/PATCH/DELETE body validates before the handler runs. Error responses never leak schema paths.
- **Atomic generation lock** — previously a race: read → check → write let two tabs both start generation. Now `UPDATE users SET generation_lock_expires_at = ? WHERE id = ? AND (generation_lock_expires_at IS NULL OR generation_lock_expires_at < ?) RETURNING id`. Single statement, TOCTOU-safe.
- **IDOR protection** — every mutation on a user-owned resource (sessions, playlist tracks) runs an ownership check and returns 403 on mismatch.
- **Deterministic Director, cached LLM rubric** — Vibe Profiler hits are cached by sorted game IDs, so rerolls don't re-burn LLM quota. Cache miss is gated by `USER_DAILY_LLM_CAP = 10`. Over-cap fallback is a static arc template — no degraded playlist, just no custom rubric.
- **No YouTube iframe in the React tree** — the iframe singleton is mounted off-screen outside App Router so it survives navigation events without tearing down playback.

---

## Running locally

**Requirements:** Node.js ≥ 22, pnpm, `wrangler` (Cloudflare CLI, only needed for prod deploys)

```bash
git clone https://github.com/talzerr/bgmancer.git
cd bgmancer
pnpm install
cp .env.local.example .env.local
pnpm db:migrate
pnpm dev                # → http://localhost:6959
```

### Environment

All env vars flow through the typed lazy singleton at `src/lib/env.ts`. Never use `process.env` directly.

| Var | Required | Notes |
|-----|----------|-------|
| `NEXTAUTH_SECRET` | Prod + dev | ≥32 chars; `openssl rand -base64 32` |
| `YOUTUBE_API_KEY` | Yes | All playlist generation |
| `ANTHROPIC_API_KEY` | Yes | Tagging, Vibe Profiler, session naming |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Prod | Dev uses a Credentials provider |
| `STEAM_API_KEY` | Optional | Steam library sync |
| `IGDB_CLIENT_ID` / `IGDB_CLIENT_SECRET` | Optional | Together with Turnstile, enables catalog "Request a game" form |
| `TURNSTILE_SITE_KEY` / `TURNSTILE_SECRET_KEY` | Optional | Cloudflare Turnstile for guest gen + game requests |
| `DISCOGS_TOKEN` | Optional | Higher-rate tracklist loading for backstage onboarding |
| `ANTHROPIC_TAGGING_MODEL` | Optional | Model override for track tagging |
| `ANTHROPIC_VIBE_MODEL` | Optional | Model override for the Vibe Profiler |
| `ANTHROPIC_NAMING_MODEL` | Optional | Model override for session-name generation |

Backstage (`/backstage/*`) is open in local dev. In production it's gated by Cloudflare Access.

### Common commands

```bash
pnpm dev                # port 6959, Turbopack
pnpm build              # production build
pnpm lint               # ESLint (lint:fix for auto-fix)
pnpm format             # Prettier (format:check to verify)
pnpm test               # Vitest (test:watch, test:coverage)
pnpm db:generate        # diff schema → new migration
pnpm db:migrate         # apply migrations to local D1
pnpm db:reset           # wipe local D1 (then db:migrate)
pnpm preview            # build + run in Workers runtime
```

Husky pre-commit runs lint + format on staged `.ts`/`.tsx` files.

---

## Deployment

Cloudflare Workers via `@opennextjs/cloudflare`. Infrastructure defined in `wrangler.jsonc`.

```bash
pnpm cf-typegen
pnpm opennextjs-cloudflare build
wrangler deploy
wrangler d1 migrations apply bgmancer-prod --remote

# staging
wrangler deploy --env staging
wrangler d1 migrations apply bgmancer-staging --remote --env staging

# secrets
wrangler secret put <NAME>              # prod
wrangler secret put <NAME> --env staging

# ops
wrangler rollback
wrangler tail
```

---

## Docs

- [CLAUDE.md](CLAUDE.md) — architecture invariants, auth model, pipeline, deployment. The canonical reference.
- [DIRECTOR.md](DIRECTOR.md) — the playlist-assembly algorithm spec (the craft moat)
- [BACKLOG.md](BACKLOG.md) — bugs, pre-launch work, and future ideas
- [CONTRIBUTING.md](CONTRIBUTING.md) — how to contribute
- [SECURITY.md](SECURITY.md) — vulnerability reporting
- [LEGAL.md](LEGAL.md) — disclaimers, privacy, third-party terms
- [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) — community standards
- [LICENSE](LICENSE) — MIT

---

## Credits & contact

Built by [@talzerr](https://github.com/talzerr). Architecture and product decisions are human-led; implementation is Claude Code-assisted under active review.

Reach me on Discord: `talzxc`. Questions, bug reports, and ideas welcome via [GitHub Issues](https://github.com/talzerr/bgmancer/issues).

---

## License

BGMancer is licensed under the **[MIT License](LICENSE)**.

**Trademark:** The BGMancer name is a trademark of Tal Koviazin. The MIT license covers the code only — it does not grant rights to use the BGMancer name for derivative projects.
