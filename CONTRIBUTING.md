# Contributing to BGMancer

## Local development

**Requirements:** Node.js ≥ 18, a [YouTube Data API v3 key](https://console.cloud.google.com/), a [Steam API key](https://steamcommunity.com/dev/apikey), and either an [Anthropic API key](https://console.anthropic.com/) or [Ollama](https://ollama.com/) running locally.

```bash
git clone https://github.com/talzerr/bgmancer.git
cd bgmancer
npm install
cp .env.local.example .env.local
# Fill in at minimum: YOUTUBE_API_KEY, STEAM_API_KEY, NEXTAUTH_SECRET
npm run dev   # → http://localhost:6959
```

The SQLite database (`bgmancer.db`) is created automatically on first run.

## Code quality

Lint and format checks run automatically via husky on staged `.ts`/`.tsx` files before every commit. To run manually:

```bash
npm run lint        # check
npm run lint:fix    # auto-fix
npm run format      # write
npm run format:check
```

There are no automated tests. Lint must pass before a PR can be merged.

## Submitting changes

- **One logical change per PR.** Separate refactors from features.
- **Branch off `main`**, name it something descriptive (`feat/repeat-mode`, `fix/tagger-junk`).
- **Commit message format:** `type: short description` where type is one of `feat`, `fix`, `refactor`, `chore`, `docs`, `style`.
- Open the PR against `main`. Describe what changed and why in the PR body.

## What's welcome

- Bug fixes (open an issue first if the fix is non-trivial)
- Features listed in [BACKLOG.md](BACKLOG.md)
- OST tagging improvements or corrections to `data/yt-playlists.json`

## What's not welcome (yet)

- Dependency upgrades unless there's a security reason
- Structural refactors without prior discussion
- Changes to the Director algorithm or DB schema without an issue discussion first
