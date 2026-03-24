# Security Policy

## Reporting a vulnerability

**Do not open a public GitHub issue for security vulnerabilities.**

Please report security issues privately via GitHub Security Advisories:

**→ [Report a vulnerability](https://github.com/talzerr/bgmancer/security/advisories/new)**

You can expect an acknowledgement within **7 days** and a status update within **30 days**.

## Scope

Issues in the following areas are in scope:

- **Session / authentication** — cookie security, JWT handling, session fixation
- **API key exposure** — leaking `YOUTUBE_API_KEY`, `ANTHROPIC_API_KEY`, or `STEAM_API_KEY` via logs, responses, or client bundles
- **Injection** — SQL injection, prompt injection into LLM calls, command injection
- **Ownership bypass** — accessing or modifying another user's library, sessions, or playlist data
- **Rate limiting** — bypassing generation or import limits in ways that could cause quota abuse or DoS

## Out of scope

- Vulnerabilities in upstream dependencies (YouTube API, Anthropic, Steam) — report those to the respective vendors
- Self-hosted instances configured insecurely by the operator
- Issues that require physical access to the server
- Theoretical issues with no demonstrated impact
