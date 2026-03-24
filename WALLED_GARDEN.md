# Walled Garden — Work Document

## Context

BGMancer is shifting from "user adds any game, system auto-onboards" to "admin curates a catalog in Backstage, users pick from published games only." All existing automation (Discogs fetch, LLM tagging, YouTube discovery) stays but becomes admin-triggered. Games go through phased onboarding with a publish gate. A "quick onboard" path chains all phases for bulk backfill. The only AI in the user flow is playlist generation (Vibe Profiler + Director).

On-the-fly user onboarding stays in the codebase but is disabled. Backstage will eventually be Cloudflare-gated but not yet — the app should be ready for it (no auth changes needed now).

---

## M1: Game Lifecycle Schema

**Goal:** Replace `TaggingStatus` with `OnboardingPhase`, add `published` column, update all references. App behavior unchanged — this is a pure rename/extend.

### Schema change (`src/lib/db/schema.ts`)

- Rename column `tagging_status` → `onboarding_phase` (default `'draft'`)
- Add column `published INTEGER NOT NULL DEFAULT 0`
- Run `npm run db:reset` to apply

### New enum (`src/types/index.ts`)

Replace `TaggingStatus` with:

```ts
enum OnboardingPhase {
  Draft = "draft", // game exists, no tracks
  TracksLoaded = "tracks_loaded", // tracklist fetched (Discogs/VGMDB/manual)
  Tagged = "tagged", // LLM tagger has run
  Resolved = "resolved", // YouTube video IDs assigned
  Published = "published", // visible to users (implies resolved)
  Failed = "failed", // onboarding error
}
```

Drop `Limited` — it was a workaround for bad auto-onboarding. Games with partial data stay in whatever phase they reached; the admin fixes or discards them.

### Type change (`src/types/index.ts`)

`Game` interface: `tagging_status: TaggingStatus` → `onboarding_phase: OnboardingPhase`, add `published: boolean`.

### Files to update (find-replace `TaggingStatus` → `OnboardingPhase`, `tagging_status` → `onboarding_phase`)

- `src/types/index.ts` — enum + Game interface
- `src/lib/db/schema.ts` — column rename + add published
- `src/lib/db/mappers.ts` — `toGame()` mapper
- `src/lib/db/repos/games.ts` — `setStatus()`, `searchWithStats()`, `BackstageGame`, add `Games.setPublished()`, add `Games.listPublished()`
- `src/lib/pipeline/onboarding.ts` — status transitions
- `src/lib/pipeline/candidates.ts` — `TaggingStatus.Limited` reference
- `src/lib/events.ts` — `GameStatusPayload` type
- `src/app/api/backstage/reingest/route.ts` — status refs
- `src/app/api/backstage/retag/route.ts` — status refs
- `src/app/(backstage)/backstage/games/games-client.tsx` — filter dropdown values
- `src/app/(main)/library/library-client.tsx` — status badge checks
- `src/app/(main)/feed-client.tsx` — indexing/failed count checks
- `src/hooks/useGameLibrary.ts` — SSE status payload
- `src/components/backstage/StatusBadge.tsx` — styles for new phases

### Acceptance

- [ ] `npm run db:reset` succeeds
- [ ] `npm run build` — zero type errors (no `TaggingStatus` references remain)
- [ ] `npm run lint` passes
- [ ] Backstage games table shows new phase names with correct badge colors
- [ ] Main app still works (existing flow uses new enum values, no behavioral change)

---

## M2: Phased Onboarding Actions in Backstage

**Goal:** Break the monolithic `onboardGame()` into discrete admin-triggered phases. Each phase is an independent Backstage action.

### Refactor onboarding (`src/lib/pipeline/onboarding.ts`)

Split into composable functions:

1. **`loadTracks(game, onProgress?)`** — Discogs search + `Tracks.upsertBatch()` + set `tracklist_source`. Sets phase → `TracksLoaded`. Does NOT tag.
2. **`tagGameTracks(game, onProgress?)`** — runs LLM tagger on existing untagged tracks. Sets phase → `Tagged`.
3. **`resolveVideos(game, onProgress?)`** — discovers YouTube playlist (extract from `candidates.ts:discoverOSTPlaylist`), fetches playlist items, calls `resolveTracksToVideos()`, stores in `video_tracks`. Sets phase → `Resolved`.
4. **`quickOnboard(game, onProgress?)`** — chains loadTracks → tagGameTracks → resolveVideos → set published. Reuses all three above.

Keep `ingestFromDiscogs()` as a thin wrapper calling `loadTracks` + `tagGameTracks` (backward compat for reingest route).

### Extract from candidates.ts

`discoverOSTPlaylist()` and `ensureVideoMetadata()` are currently private to `candidates.ts` and coupled to the generation SSE. Extract them into importable helpers (or a new `src/lib/pipeline/youtube-resolve.ts`) so `resolveVideos()` can call them without the generation event system.

### New API routes

| Route                          | Method | Body                          | Response   | Calls                     |
| ------------------------------ | ------ | ----------------------------- | ---------- | ------------------------- |
| `/api/backstage/load-tracks`   | POST   | `{ gameId }`                  | SSE stream | `loadTracks()`            |
| `/api/backstage/resolve`       | POST   | `{ gameId }`                  | SSE stream | `resolveVideos()`         |
| `/api/backstage/publish`       | POST   | `{ gameId, published }`       | JSON       | `Games.setPublished()`    |
| `/api/backstage/quick-onboard` | POST   | `{ gameId }` or `{ gameIds }` | SSE stream | `quickOnboard()` per game |

Existing routes updated:

- `/api/backstage/retag` → sets phase to `Tagged` on completion
- `/api/backstage/reingest` → resets phase to `Draft` first, then runs loadTracks + tagGameTracks, lands on `Tagged`

### UI changes (`game-detail-client.tsx`)

Replace the current 2-button layout (Re-tag, Re-ingest) with:

- **Phase stepper** at the top of game detail: visual breadcrumb showing Draft → TracksLoaded → Tagged → Resolved → Published, current phase highlighted
- **Phase action buttons**: "Load Tracks", "Tag", "Resolve Videos" — each triggers its SSE route, uses existing `SSEProgress` component
- **"Quick Onboard"** button — runs the full chain
- **"Publish" / "Unpublish"** toggle
- Keep **"Re-ingest"** as destructive action (clears everything, starts over)
- Keep **"Re-tag"** as a redo for the tagging phase only

### Acceptance

- [ ] Admin can run each phase independently from game detail page
- [ ] "Load Tracks" fetches Discogs tracklist without tagging
- [ ] "Tag" runs LLM tagger on loaded tracks
- [ ] "Resolve" discovers YouTube playlist and maps tracks to video IDs
- [ ] "Quick Onboard" chains all phases and sets published=true
- [ ] Phase stepper reflects current phase accurately
- [ ] Publish/unpublish toggle works
- [ ] `npm run build` + `npm run lint` pass

---

## M3: Backstage Catalog Management

**Goal:** Admin can add games, edit all game-level metadata, bulk-onboard, and manage the catalog — all from Backstage.

### Game creation in Backstage

- `Games.createDraft(title, steamAppid?, playtimeMinutes?)` — creates game as `Draft`, `published=0`, no library link
- `POST /api/backstage/games` — body: `{ title, steam_appid?, playtime_minutes? }`, returns created game
- Games list (`games-client.tsx`): add "Add Game" button → dialog with manual title entry + optional Steam app ID

### Game metadata editing

- `PATCH /api/backstage/games/[gameId]` — update `title`, `steam_appid`, `yt_playlist_id`, `tracklist_source`, `playtime_minutes`
- `Games.updateMetadata(id, fields)` repo method
- Game detail page: editable fields for title, Steam App ID, YouTube playlist ID (admin can paste a known playlist URL/ID to skip auto-discovery)
- Show Steam header image when `steam_appid` is set (URL: `https://cdn.akamai.steamstatic.com/steam/apps/{appid}/header.jpg`)

### Catalog filters

- Games list: add Published/Unpublished/All filter toggle
- Games list: add onboarding phase filter (Draft, TracksLoaded, Tagged, Resolved, Published, Failed)
- Summary line: "12 draft, 3 tagged, 45 published" counts

### Bulk operations

- Checkbox selection on games list
- "Quick Onboard Selected" bulk action
- "Publish Selected" / "Unpublish Selected" bulk actions

### Track editing expansion

Expand `TrackEditSheet` (`PatchUpdates`) to include:

- `videoId` — assign/change linked YouTube video
- `durationSeconds` — override duration
- `viewCount` — override view count

Expand `PATCH /api/backstage/tracks` to handle video_track upserts when `videoId` is provided.
Add `VideoTracks.upsertSingle()` repo method.

### Files

- `src/lib/db/repos/games.ts` — `createDraft()`, `updateMetadata()`
- `src/app/api/backstage/games/route.ts` — add POST handler
- `src/app/api/backstage/games/[gameId]/route.ts` — new file, PATCH handler
- `src/app/(backstage)/backstage/games/games-client.tsx` — add game button, filters, bulk actions
- `src/app/(backstage)/backstage/games/[slug]/game-detail-client.tsx` — editable metadata fields
- `src/components/backstage/TrackEditSheet.tsx` — video fields
- `src/app/api/backstage/tracks/route.ts` — video_track upsert in PATCH
- `src/lib/db/repos/video-tracks.ts` — `upsertSingle()`

### Acceptance

- [ ] Admin can create a new game from Backstage (manual entry)
- [ ] Admin can edit game title, Steam App ID, YouTube playlist ID
- [ ] Admin can edit video ID, duration, view count per track
- [ ] Published/phase filters work in games list
- [ ] Bulk quick-onboard works for selected games
- [ ] Bulk publish/unpublish works
- [ ] Steam header image shows when appid is set
- [ ] `npm run build` + `npm run lint` pass

---

## M4: Published Gate — Lock the Main App

**Goal:** Users see only published games. Remove user-facing onboarding. Preserve old code paths (commented/disabled).

### Library page transformation (`library-client.tsx`)

Replace "Add Game" form + Steam Import panel with a **Catalog Browser**:

- Search/browse all published games
- Click to add/remove from personal library
- Games already in library show a checkmark
- Keep curation mode controls (skip/lite/include/focus) for games in library
- Keep existing sort/filter/pagination for user's library

### API changes

- `POST /api/games` — change from "create game + onboard" to "link published game to library". Body: `{ gameId }` (ID of existing published game). Remove `onboardGame()` call. Comment old code: `// [WALLED_GARDEN] on-the-fly onboarding disabled`
- `GET /api/games/catalog` — new route returning `Games.listPublishedCatalog()` for the catalog browser
- `POST /api/steam/import` — disable auto-onboarding. Comment: `// [WALLED_GARDEN] disabled`. Either return 403 or only link games that already exist in published catalog.

### Query changes (`src/lib/db/repos/games.ts`)

- `Games.listAll(userId)` — add `AND g.published = 1` filter (generation only uses published games)
- `Games.listAllIncludingDisabled(userId)` — add `AND g.published = 1` (library page only shows published games in user's library)
- `Games.listPublishedCatalog()` — all published games, no user scope, for catalog browser

### Pipeline guard (`src/lib/pipeline/index.ts`)

- If `Games.listAll()` returns empty after published filter, send a clear error event: "No published games in your library"

### Cleanup in main app

- `feed-client.tsx` — remove indexing/failed count indicators, simplify to "N games in library"
- `useGameLibrary.ts` — SSE status-stream subscription becomes unnecessary for user flow (games don't change phase). Keep but mark as vestigial. Or remove if Backstage has its own.
- Keep `AddGameForm`, `SteamImportPanel` components in codebase but unused

### New files

- `src/components/CatalogBrowser.tsx` — searchable published game list with add-to-library
- `src/app/api/games/catalog/route.ts` — GET published catalog

### Acceptance

- [ ] Library page shows "Browse Catalog" instead of add-game form
- [ ] Users can only add published games to their library
- [ ] Users cannot create new games or trigger onboarding
- [ ] Playlist generation only uses published games
- [ ] Generating with no published games shows clear error
- [ ] Curation modes still work for library games
- [ ] Steam import is disabled for users
- [ ] Old onboarding code is preserved but not called
- [ ] `npm run build` + `npm run lint` pass

---

## M5: Cleanup and Backstage Dashboard

**Goal:** Remove dead code, add an onboarding overview dashboard, final polish.

### Backstage onboarding dashboard

Add a summary view (either on the backstage index page or a new "Catalog" tab):

- Counts by phase: "15 draft, 8 tracks loaded, 5 tagged, 3 resolved, 220 published, 2 failed"
- Quick links to filtered game lists per phase
- "Games needing attention" — failed + has review flags

### Dead code removal

- Remove `TaggingStatus` enum entirely (if any aliased references remain)
- Remove `Limited` status handling from `candidates.ts` (legacy path for untagged games) — in the walled garden, all generated games are tagged+resolved
- Clean up `onboardGame()` — keep as internal tool but remove the event bus broadcast (no user SSE listens for it anymore)
- Remove `GameProgressStatus` from SSE if generation no longer needs per-game onboarding progress (games are already resolved; phases 1/1.5 become no-ops or simple lookups)

### Generation pipeline simplification

With all games pre-resolved, `fetchGameCandidates()` in `candidates.ts` simplifies significantly:

- No need to discover YouTube playlists at generation time (already cached)
- No need for LLM track-to-video resolution (already in `video_tracks`)
- Phase 1/1.5 becomes: "look up pre-resolved data from video_tracks + tracks table"
- This is a significant performance win — generation becomes fast

### Review flags reassessment

With admin-curated data, review flags become less critical (the admin already reviewed everything). Consider:

- Keep the flag system for "quick onboard" results that need admin review
- Remove auto-flagging from the generation pipeline (no more runtime flags)
- The Backstage review flag UI stays as-is

### Acceptance

- [ ] Backstage shows onboarding phase summary dashboard
- [ ] No `TaggingStatus` references in codebase
- [ ] Generation pipeline skips discovery/resolution for pre-resolved games (fast path)
- [ ] `npm run build` + `npm run lint` pass
- [ ] Full end-to-end: admin creates game → quick onboard → publish → user adds to library → generate playlist

---

## Milestone Dependency Graph

```
M1 (Schema)
 └─ M2 (Phased Actions)
     └─ M3 (Catalog Management)
         └─ M4 (Published Gate)    ← behavioral change for users
             └─ M5 (Cleanup)
```

Each milestone is independently shippable. The user-visible change happens at M4. Everything before is additive and backward-compatible.

---

## Key Existing Code to Reuse

| What                              | Where                                         | Reused in                                     |
| --------------------------------- | --------------------------------------------- | --------------------------------------------- |
| `ingestFromDiscogs()`             | `src/lib/pipeline/onboarding.ts`              | M2: split into `loadTracks` + `tagGameTracks` |
| `discoverOSTPlaylist()`           | `src/lib/pipeline/candidates.ts`              | M2: extract for `resolveVideos()`             |
| `resolveTracksToVideos()`         | `src/lib/pipeline/resolver.ts`                | M2: called by `resolveVideos()`               |
| `ensureVideoMetadata()`           | `src/lib/pipeline/candidates.ts`              | M2: extract for `resolveVideos()`             |
| `tagTracks()`                     | `src/lib/pipeline/tagger.ts`                  | M2: called by `tagGameTracks()`               |
| `SSEProgress` component           | `src/components/backstage/SSEProgress.tsx`    | M2: all new phase actions                     |
| `TrackEditSheet`                  | `src/components/backstage/TrackEditSheet.tsx` | M3: extend with video fields                  |
| `makeSSEStream()`                 | `src/lib/sse.ts`                              | M2: all new SSE routes                        |
| `gameSlug()` / `idFromGameSlug()` | `src/lib/utils.ts`                            | M3: new game detail URLs                      |
