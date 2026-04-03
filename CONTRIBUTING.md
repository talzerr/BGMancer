# Contributing to BGMancer

Thanks for your interest in contributing! BGMancer is a hobby project, so contributions are welcome but reviewed at a relaxed pace.

## Getting started

1. Fork the repo and clone it locally
2. Follow the [README](README.md) to set up your dev environment
3. See [CLAUDE.md](CLAUDE.md) for architecture docs, code style, and commands

## Before you start

- **Check the [BACKLOG.md](BACKLOG.md)** for planned features
- **Open an issue first** for large changes — let's discuss the approach before you invest time
- **Bug fixes and small improvements** can go straight to a PR

## Submitting a PR

1. Create a branch from `main`
2. Make your changes
3. Run `pnpm test`, `pnpm lint`, `pnpm format:check` — all must pass
4. Open a PR with a clear description of what and why

## Code style

- TypeScript strict mode
- Use `enum` for named value sets (not string literal unions)
- Use the `env` singleton from `@/lib/env` — never `process.env` directly
- Every route must be registered in `src/lib/route-config.ts`
- See [CLAUDE.md](CLAUDE.md) for the full style guide

## Code of Conduct

This project follows the [Contributor Covenant Code of Conduct](CODE_OF_CONDUCT.md). By participating, you agree to uphold it.
