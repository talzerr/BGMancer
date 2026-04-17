# Testing Patterns

**Analysis Date:** 2026-04-17

## Test Framework

**Runner:**

- Vitest (configured in `vitest.config.ts`)
- Two separate projects: `node` (`.test.ts`) and `jsdom` (`.test.tsx`)
- Node tests run with Node environment; React/jsdom tests run with jsdom environment

**Assertion Library:**

- Vitest built-in assertions (`expect()`)
- React Testing Library helpers for component tests (`render`, `waitFor`, `act`)

**Run Commands:**

```bash
pnpm test              # Run all tests
pnpm test:watch       # Watch mode
pnpm test:coverage    # Coverage report (v8 provider)
```

**Coverage:**

- Provider: v8
- Thresholds: 100% functions, 100% lines (enforced)
- Include: `src/lib/**/*.ts` (all library code)
- Exclude: test files, type files, barrel exports, type-only files, schema definitions, heavy orchestrators

**Excluded from Coverage (justified):**

- `src/lib/env.ts` — Bootstrap/config
- `src/lib/db/repo.ts` — Barrel re-export
- `src/lib/db/index.ts` — Factory function
- `src/lib/db/drizzle-schema.ts` — Schema definition only
- `src/lib/db/test-helpers.ts` — Test support (excluded by test rule)
- `src/lib/llm/provider.ts` — Type-only interface
- `src/lib/pipeline/generation/types.ts` — Type definitions
- `src/lib/services/auth/auth.ts` — NextAuth bootstrap
- `src/lib/services/infra/kv.ts` — Requires Cloudflare Workers runtime
- Pipeline orchestrators (`src/lib/pipeline/generation/index.ts`, `src/lib/pipeline/onboarding/index.ts`, `src/lib/pipeline/onboarding/resolver.ts`, `src/lib/pipeline/onboarding/youtube-resolve.ts`) — Chain 3+ external services; appropriate for E2E tests, not unit/integration tests

## Test File Organization

**Location:**

- Co-located in `__tests__/` subdirectories adjacent to source files
- Pattern: `src/lib/services/auth/__tests__/auth-helpers.test.ts` next to `src/lib/services/auth/auth-helpers.ts`

**Naming:**

- Unit tests: `*.test.ts` (Node environment)
- React component tests: `*.test.tsx` (jsdom environment)
- Integration tests: `*.integration.test.ts` (explicit suffix for external services)

## Test Structure

**Suite Organization:**
Nested `describe("when X")` blocks group related test cases. Use `beforeEach()`/`afterEach()` for isolation. Follow Arrange-Act-Assert pattern within each test.

**Vitest-specific setup:**

- `// @vitest-environment jsdom` at top of jsdom tests (e.g., component and hook tests)
- `import "@testing-library/jest-dom/vitest"` in jsdom tests for DOM matchers
- Import from `vitest` only, never `jest`

## Mocking

**Framework:** `vi` (Vitest mock API)

**Patterns:**

Module mocking with `vi.mock()`: return an object with implementation (can import test constants dynamically)

Function mocking with `vi.fn()`: wrap global functions or create spy callbacks

DOM/framework mocking: mock Next.js APIs like `next/image` with simple JSX replacements

**What to Mock:**

- External modules (fetch, APIs, SDKs)
- Next.js framework APIs
- Database layer (use `createTestDrizzleDB()` instead)
- LLM calls (return canned responses)

**What NOT to Mock:**

- Business logic under test
- Data transformers/mappers
- Validation (Zod schemas)
- Error handling paths

## Fixtures and Factories

**Test Data:**

`src/test/constants.ts` — Shared constants: `TEST_USER_ID`, `TEST_USER_EMAIL`, `TEST_GAME_ID`, `TEST_GAME_TITLE`, `TEST_TRACK_NAME`, `TEST_VIDEO_ID`, etc.

`src/lib/db/test-helpers.ts` — Database seeding:

- `createTestDrizzleDB()` — Returns in-memory SQLite with full schema via migrations
- `seedTestUser(db, userId?)` — Inserts test user + library
- `seedTestGame(db, userId, overrides?)` — Inserts test game linked to user's library
- `seedTestTracks(db, gameId, count, tagged?)` — Inserts N tracks for a game
- `seedTestSession(db, userId, overrides?)` — Inserts test playlist for user

`src/test/route-helpers.ts` — Request/response utilities:

- `makeGetRequest(path, params?)` — Build GET request with query params
- `makeJsonRequest(path, method, body?)` — Build POST/PATCH/DELETE request
- `parseJson<T>(response)` — Extract JSON from Response

File-specific factories inline at test top (e.g., `insertPlaylistTrack()`).

## Coverage

**Requirements:** 100% functions, 100% lines (enforced via `vitest.config.ts`)

**View Coverage:**

```bash
pnpm test:coverage
```

HTML report at `coverage/index.html`.

**Policy:**

- Every uncovered line must be either tested OR added to exclude list with justification
- No "intentional gaps" — justify all untested code

## Test Types

**Unit Tests:**

- Scope: Single function in isolation
- Approach: Mock all external dependencies
- Examples: `parseTagItem()`, validation schemas, mappers
- Run time: Milliseconds

**Integration Tests:**

- Scope: Service + database layer (e.g., route handler + repo)
- Approach: Real in-memory DB via `createTestDrizzleDB()`, mock external services
- Examples: `POST /api/playlist` with seeded data, Steam sync service
- Run time: Milliseconds to seconds

**E2E Tests:**

- Not implemented; marked as excluded from coverage
- Would use real databases and live API calls

## Common Patterns

**Async Testing:**

```typescript
await waitFor(() => expect(result.current.playlistMode).toBe(PlaylistMode.Journey));
```

**Error Testing:**

```typescript
expect(() => extractTagArray("invalid")).toThrow("No JSON array found in response");
expect(() => parseTagItem({ ...validItem, energy: 0 })).toBeNull();
```

**Database Testing:**

```typescript
beforeEach(() => {
  ({ db, rawDb } = createTestDrizzleDB());
  seedTestUser(rawDb);
});

const gameId = seedTestGame(rawDb, TEST_USER_ID, { id: TEST_GAME_ID });
const sessionId = seedTestSession(rawDb, TEST_USER_ID);
insertPlaylistTrack("pt1", sessionId, gameId, { trackName: "Track 1" });
```

**Hook Testing (jsdom):**

```typescript
localStorage.setItem("bgm_playlist_mode", "low");
const { result } = renderHook(() => useConfig());
await waitFor(() => expect(result.current.playlistMode).toBe(PlaylistMode.Chill));

act(() => result.current.savePlaylistMode(PlaylistMode.Rush));
expect(localStorage.getItem("bgm_playlist_mode")).toBe("high");
```

**Fetch Mocking:**

```typescript
global.fetch = vi.fn((input, init) => {
  const url = typeof input === "string" ? input : input.toString();
  if (url.startsWith("/api/games/search-igdb")) {
    return Promise.resolve({ ok: true, status: 200, json: async () => ({ results: [...] }) } as Response);
  }
  return Promise.resolve({ ok: false, status: 500, json: async () => ({ error: "boom" }) } as Response);
});
```

---

_Testing analysis: 2026-04-17_
