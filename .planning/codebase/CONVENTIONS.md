# Coding Conventions

**Analysis Date:** 2026-04-17

## Naming Patterns

**Files:**

- React components: PascalCase (e.g., `LogoLink.tsx`, `FeedClient.tsx`)
- Utilities and services: camelCase (e.g., `useConfig.ts`, `steam-sync.ts`)
- Constants/configs: camelCase or UPPER_CASE (e.g., `route-config.ts`, `constants.ts`)
- Tests: `*.test.ts` for Node, `*.test.tsx` for jsdom (e.g., `useConfig.test.ts`)
- Directories: kebab-case (e.g., `arc-templates`, `game-requests`)
- Type files: `*.ts` (may contain enums, interfaces, types)

**Functions:**

- Regular functions: camelCase (e.g., `getAuthUserId`, `createTestDrizzleDB`)
- React hook functions: `use` prefix, camelCase (e.g., `useConfig`, `usePlayerContext`)
- Handler/resolver functions: descriptive verbs (e.g., `assemblePlaylist`, `parseTagItem`)
- Private/internal functions: `_` prefix optional when truly internal (e.g., `_extractTagArray`)

**Variables:**

- camelCase for all local variables and state (e.g., `targetTrackCount`, `allowLongTracks`)
- Constants (file-level): UPPER_SNAKE_CASE (e.g., `DEFAULT_TRACK_COUNT`, `MAX_TRACK_COUNT`)
- Object keys in `const` objects: camelCase (e.g., `targetTrackCount` in `KEYS` object)
- Underscore prefix to suppress unused-vars warnings (e.g., `_err`, `_unused`)

**Types & Enums:**

- Interfaces: PascalCase, no `I` prefix (e.g., `User`, `PlaylistSession`, `TrackDecision`)
- Enums: PascalCase, values are fully lowercase strings/identifiers (e.g., `enum PlaylistMode { Journey = "journey", Chill = "low" }`)
- Enum values: match API/database format (lowercase, kebab-case for compound names; e.g., `focus_pre`, `last_resort`)
- Type unions: PascalCase or inherit naming (e.g., `AuthResult = { authenticated: true; userId: string } | { authenticated: false }`)

## Code Style

**Formatting:**

- Tool: Prettier (configured in `.prettierrc`)
- Print width: 100 characters
- Tab width: 2 spaces
- Trailing commas: all
- Semicolons: required
- String quotes: double quotes (not single)
- Tailwind CSS plugin: sorts class attributes

**Linting:**

- Tool: ESLint with Next.js and TypeScript support (configured in `eslint.config.mjs`)
- Automatically run on staged files via Husky pre-commit hook (`.ts`, `.tsx` only)
- Manual run: `pnpm lint` (check), `pnpm lint:fix` (auto-fix)

**Key linting rules:**

- No `var`, only `const` and `let`
- Prefer `const`; use `let` only when the variable is reassigned
- Strict equality (`===`, `==`) except `== null` allowed (catches both null and undefined)
- No `console.log` (banned); allow `console.warn` and `console.error` for server-side logging
- No unused variables (leading `_` suppresses the rule)
- `import type` required for type-only imports (keeps JS bundle clean)
- No non-null assertions (`!`) except in DB repos and tests
- Object shorthand required (e.g., `{ foo }` not `{ foo: foo }`)
- Template literals over string concatenation
- Specific relaxations:
  - DB repos (`src/lib/db/repos/**/*.ts`): non-null assertions allowed (SQL guarantees results)
  - Test files: non-null assertions, explicit `any`, plain `<img>` allowed

## Import Organization

**Order:**

1. Framework imports (React, Next.js, Node stdlib)
2. Third-party packages (Drizzle, Zod, etc.)
3. Type-only imports from same codebase (`import type { ... }`)
4. Regular imports from same codebase (`import { ... }`)
5. Relative imports (at bottom, rarely used due to `@` alias)

**Path Aliases:**

- Single alias: `@/*` → `./src/*` (configured in `tsconfig.json`)
- All imports use `@` prefix (e.g., `@/lib/db`, `@/hooks/useConfig`, `@/types`)
- Never use relative imports like `../../../` — use `@` instead

**Example import block:**

```typescript
import { NextResponse } from "next/server";
import { sql, inArray, eq } from "drizzle-orm";
import { z } from "zod/v4";

import type { Game } from "@/types";
import { getDB } from "@/lib/db";
import { validateGame } from "@/lib/validation";
```

## Error Handling

**Custom Error Classes:**

- Inherit from `Error` with explicit `name` property assignment (e.g., `this.name = "AuthRequiredError"`)
- Define in a single file alongside their usage (e.g., `src/lib/services/auth/auth-helpers.ts`)
- Established custom errors: `AuthRequiredError`, `YouTubeQuotaError`, `YouTubeInvalidKeyError`, `SteamApiError`, `PrivateProfileError`, `VanityNotFoundError`, `CooldownError`, `InvalidSteamUrlError`, `MissingSteamUrlError`

**Error Propagation:**

- Route handlers wrap errors in `NextResponse.json({ error: ... }, { status: 4xx|5xx })`
- Zod validation errors use `zodErrorResponse(error)` helper in `src/lib/validation.ts` (returns structured error with 400 status)
- Database/service errors are caught and re-thrown as domain-specific errors (e.g., `SteamApiError` from Steam sync service)
- Async generators (SSE streams) emit `SSEEventType.Error` messages instead of throwing

**Null Safety:**

- Use optional chaining (`?.`) and nullish coalescing (`??`) throughout
- Explicit null checks before usage: `if (!session?.user?.id) { ... }`
- Return union types for fallible operations: `{ authenticated: true; userId: string } | { authenticated: false }`

## Logging

**Framework:** `console` (server-side only; client logging is a UI concern)

**Patterns:**

- Warn-level: use `console.warn()` for recoverable errors or important state transitions
- Error-level: use `console.error()` for unrecoverable failures or stack traces
- Never use `console.log()` for debugging (removed via linting)
- Structured logging: log objects as JSON when context helps (e.g., error details, decision telemetry)

## Comments

**When to Comment:**

- No narration comments (e.g., "increment counter" is obvious from `count++`)
- Section dividers: use horizontal-rule comments for grouping logical blocks
  ```typescript
  // ─── Authentication ────────────────────────────────────────────────────
  ```
- Explain "why", not "what": comment non-obvious algorithmic choices or business rules
  - Good: `// Guests default to "include" curation since they have no library preference`
  - Bad: `// Set curation to include`

**JSDoc/TSDoc:**

- Public functions and exported types: always include docstrings
- Format: standard JSDoc (leading `/**`, one param per line if >1, return type optional)
- Private/internal functions: only if algorithm is non-obvious
- Example:
  ```typescript
  /**
   * Persists a playlist to the database and synchronizes it to YouTube.
   * @param userId - The authenticated user ID
   * @param playlist - The playlist object with tracks
   * @returns The persisted playlist with server-assigned ID
   */
  export async function persistPlaylist(userId: string, playlist: Playlist): Promise<Playlist> {
    // ...
  }
  ```

## Function Design

**Size:** Aim for 50–100 lines per function; break at logical boundaries

- Hook functions in `src/hooks/` often handle state setup and are longer (acceptable)
- Service functions in `src/lib/services/` should be concise and single-purpose
- Large orchestrators (pipeline stages) are explicitly excluded from coverage, accepted as-is

**Parameters:**

- Positional: 1–3 parameters (if >3, use an object parameter)
- Object parameters: destructure inline (e.g., `{ userId, gameId }`)
- Optional parameters: use `?` in types, default to `undefined`
- No boolean trap (passing `true`/`false` without context) — use named parameters or enums

**Return Values:**

- Simple data: return the value directly
- Fallible operations: return a union type (`T | null`, or `Success | Failure` object)
- Async operations: always `Promise<T>`, never void (allows awaiting side effects)
- SSE streams: return `ReadableStream<Uint8Array>` (managed by `makeSSEStream` factory)

## Module Design

**Exports:**

- Named exports only (no default exports) except:
  - React components may have default export (preference is named)
  - Next.js route handlers: `export { GET, POST, ... }`
- Barrel files (`index.ts`) re-export public APIs from sibling files
  - Example: `src/lib/db/repo.ts` re-exports all repos (`Games`, `Sessions`, `Tracks`, etc.)
- Internal files (prefixed `_` or in `__internal/`) are not re-exported

**Barrel Files:**

- Location: `index.ts` in each feature directory
- Purpose: single entry point for related exports
- Pattern: `export { X } from "./x"; export { Y } from "./y";` (no circular deps)
- Used in: `src/lib/db/repos/` (→ `repo.ts`), `src/lib/pipeline/generation/director/arc-templates/` (→ `index.ts`)

**Repo Pattern (Database Layer):**

- File per entity: `games.ts`, `sessions.ts`, `tracks.ts`, etc. in `src/lib/db/repos/`
- Each export a single object with static methods (e.g., `Games.listAll()`, `Sessions.create()`)
- Signature: `async methodName(params): Promise<T>`
- Row-to-type conversion: use mappers from `src/lib/db/mappers.ts` (e.g., `toGame(row)`)
- SQL queries: use Drizzle ORM builders or tagged template `sql` helpers, never raw SQL strings

## Key Constraints

- **Never use `process.env` directly** — import typed `env` singleton from `@/lib/env`
- **Enum values are stable** — stored in database and sent on API wire; the display labels (`PLAYLIST_MODE_LABELS`) can change without touching enum values
- **CurationMode (per-game) and PlaylistMode (per-playlist) are distinct concepts** — do not conflate them
- **Type-only imports** must use `import type` to keep the JavaScript bundle clean
- **useEffect temporal dead zone** — define all `const` variables before `useEffect` that references them
- **Guest sessions use `GUEST_SESSION_ID`** constant (`"guest"`) — never hardcode the string
- **Sessions are FIFO-evicted** — at most 3 per user; oldest automatically deleted
- **YouTube OST playlist IDs** cached on `games.yt_playlist_id` to minimize API quota usage

---

_Convention analysis: 2026-04-17_
