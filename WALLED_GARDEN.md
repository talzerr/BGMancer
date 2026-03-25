# Walled Garden — Work Document

## Context

BGMancer is shifting from "user adds any game, system auto-onboards" to "admin curates a catalog in Backstage, users pick from published games only." All existing automation (Discogs fetch, LLM tagging, YouTube discovery) stays but becomes admin-triggered. Games go through phased onboarding with a publish gate. A "quick onboard" path chains all phases for bulk backfill. The only AI in the user flow is playlist generation (Vibe Profiler + Director).

On-the-fly user onboarding stays in the codebase but is disabled. Backstage will eventually be Cloudflare-gated but not yet — the app should be ready for it (no auth changes needed now).

---

## M1: Game Lifecycle Schema — DONE

**Commit:** `refactor!: replace TaggingStatus with OnboardingPhase + add published column (M1)`

### What was done

- Replaced `TaggingStatus` enum with `OnboardingPhase` (Draft, TracksLoaded, Tagged, Resolved, Failed)
- `Published` is NOT a phase — it's an independent boolean column (`published INTEGER NOT NULL DEFAULT 0`) that controls user visibility
- Renamed `tagging_status` column → `onboarding_phase` in schema, mapper, repos, all UI
- Added `Games.setPhase()`, `Games.setPublished()`, `Games.listPublished()` repo methods
- `GameStatusPayload.status` → `.phase`, `BackstageGame` updated
- Dropped `Limited` status entirely — games stay in whatever phase they reached
- Removed user-facing onboarding status indicators from `GameRow` (users shouldn't see admin internals)
- `StatusBadge` updated with 5 phase styles (Draft=gray, TracksLoaded=blue, Tagged=cyan, Resolved=violet, Failed=red)
- Dropped `playtime_minutes` from games table (user-specific data, not relevant for admin catalog)

### Design decisions

- **`published` is a toggle, not a phase.** A game can be `Resolved` but not published (admin reviewing), or published then unpublished without losing its onboarding state.
- **`NoDiscogsData` review reason renamed to `NoTracklistSource`** — reflects that the admin sets the source, not that Discogs specifically failed.

---

## M2: Phased Onboarding Actions in Backstage — DONE

### What was done

#### Pipeline refactor (`src/lib/pipeline/onboarding.ts`)

Split monolithic `onboardGame()` into composable functions:

- **`loadTracks(game, onProgress?)`** — fetches tracklist from Discogs (or uses preset `tracklist_source`). Sets phase → `TracksLoaded`.
- **`tagGameTracks(game, onProgress?)`** — runs LLM tagger on loaded tracks. Sets phase → `Tagged`.
- **`resolveVideos(game, onProgress?)`** — discovers YouTube playlist, resolves tracks to video IDs, caches metadata. Sets phase → `Resolved`.
- **`quickOnboard(game, onProgress?)`** — chains all three + sets `published=true`.
- **`ingestFromDiscogs()`** kept as thin wrapper (loadTracks + tagGameTracks) for backward compat.
- **`onboardGame()`** delegates to `quickOnboard` with try/catch.

#### YouTube helpers extraction (`src/lib/pipeline/youtube-resolve.ts`)

- `discoverOSTPlaylist(game, onProgress?)` — extracted from `candidates.ts`, uses `onProgress` callback instead of SSE `send`
- `ensureVideoMetadata(videoIds, gameId)` — moved from `candidates.ts`
- `candidates.ts` updated to import from `youtube-resolve.ts`

#### Tracklist source format

The `tracklist_source` field uses explicit prefixes:

- `discogs-release:2934025` — Discogs release
- `discogs-master:648336` — Discogs master
- `vgmdb:12345` — VGMDB album (not yet implemented, flags as unsupported)

Auto-discover from Discogs writes the correct prefix (`discogs-master:` or `discogs-release:`) based on which search path found the result. Admin can also preset the source in the metadata editor.

#### Discogs service improvements (`src/lib/services/discogs.ts`)

- `fetchDiscogsRelease(id)` and `fetchDiscogsMaster(id)` — separate functions, no ambiguity
- `discogsGet()` returns `null` on HTTP errors instead of throwing — graceful fallback through the search chain
- `searchGameSoundtrack()` return type includes `sourceType` field

#### New API routes

| Route                          | Method | Body                    | Response   | Calls                  |
| ------------------------------ | ------ | ----------------------- | ---------- | ---------------------- |
| `/api/backstage/load-tracks`   | POST   | `{ gameId }`            | SSE stream | `loadTracks()`         |
| `/api/backstage/resolve`       | POST   | `{ gameId }`            | SSE stream | `resolveVideos()`      |
| `/api/backstage/publish`       | POST   | `{ gameId, published }` | JSON       | `Games.setPublished()` |
| `/api/backstage/quick-onboard` | POST   | `{ gameId }`            | SSE stream | `quickOnboard()`       |

#### Existing routes updated

- `/api/backstage/retag` → sets phase to `Tagged` on completion
- `/api/backstage/reingest` → uses composable `loadTracks` + `tagGameTracks` instead of monolithic `ingestFromDiscogs`
- `/api/backstage/review-flags` DELETE → supports single flag dismiss (`{ flagId, gameId }`) or clear all (`{ gameId }`)

#### Game metadata editing (pulled forward from M3)

- `PATCH /api/backstage/games/[gameId]` — update `title`, `steam_appid`, `yt_playlist_id`, `tracklist_source`, `thumbnail_url`
- `Games.update()` expanded to handle all metadata fields in a single UPDATE
- `thumbnail_url TEXT` column added to games table
- Steam games auto-populate `thumbnail_url` with Steam header image on creation (both `Games.create()` and `bulkImportSteam()`)

#### Game detail page redesign (`game-detail-client.tsx`)

**Three-zone control bar** (state-driven):

| Zone                          | Contents                                                                                                                                                                                                  |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Zone A: Primary Action**    | Context-aware button: "Fetch Tracklist" (Draft), "Run LLM Tagging" (TracksLoaded), "Resolve Videos" (Tagged), "Pipeline complete" (Resolved), "Retry" (Failed), "Review Flags (N)" (any phase with flags) |
| **Zone B: Pipeline Dropdown** | "Run Pipeline ▾" → Run Full Pipeline, Force Re-Fetch Tracks, Force Re-Tag, Force Re-Resolve                                                                                                               |
| **Zone C: Danger Zone**       | "⋯" → Reset Pipeline (Re-Sync Source) — opens type-to-confirm reingest dialog                                                                                                                             |

**Publish button** — always visible on control bar (right-aligned), disabled until Resolved. Shows "● Published" when published; on hover changes to rose color with "Unpublish" text. Tooltip when disabled: "Complete all pipeline phases before publishing".

**When published:** Pipeline dropdown, danger menu, and metadata editing are all disabled. "Unpublish to edit" hint shown.

**PhaseStepper component** (`src/components/backstage/PhaseStepper.tsx`) — visual breadcrumb: Draft → Tracks Loaded → Tagged → Resolved. Shows checkmarks for completed phases, highlight for current, red for Failed, green "Published" badge.

**Game thumbnail** — Steam header shown in game detail header. Falls back to `thumbnail_url` field. Editable in metadata section.

**Editable title** — click game title to edit (disabled when published). Max 100 chars.

**Metadata section** — inline-editable fields with ↗ link icons:

- Tracklist Source (discogs-release/discogs-master/vgmdb prefix format)
- YouTube Playlist → youtube.com link
- Thumbnail URL → direct link
- Steam App ID → store.steampowered.com link

**Track editing** — "Edit" toggle on track table header:

- Off: click row to open tag edit sheet
- On: ✕ delete button (with confirmation dialog), clickable ●/○ active toggle, "+ Add" button in header
- Edit mode: violet border + tinted background

**Track video links** — ▶ column links to youtube.com/watch?v={videoId} for resolved tracks.

**Review flags** — collapsible `<details>` (collapsed by default), individual ✕ dismiss buttons, "Clear all" link.

### Known issues

- Hydration mismatch warning may appear on game detail page (Next.js SSR vs client state timing)
- `useGameLibrary` SSE error in console on Backstage pages (pre-existing — Backstage doesn't use PlayerProvider)

---

## M3: Backstage Catalog Management — PARTIALLY DONE

### What was done in M2 (pulled forward)

- [x] Game metadata editing (title, steam_appid, yt_playlist_id, tracklist_source, thumbnail_url)
- [x] `PATCH /api/backstage/games/[gameId]` route
- [x] Steam header image auto-populated on game creation
- [x] Track deletion with FK cascade (video_tracks cleaned up)

### What remains

- [ ] Game creation in Backstage (`POST /api/backstage/games`, "Add Game" button in games list)
- [ ] Catalog filters (Published/Unpublished/All toggle, phase filter, summary counts)
- [ ] Bulk operations (checkbox selection, bulk quick-onboard, bulk publish/unpublish)
- [ ] Track editing expansion in TrackEditSheet (videoId, durationSeconds, viewCount fields)
- [ ] `VideoTracks.upsertSingle()` repo method

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
- [ ] Generation pipeline skips discovery/resolution for pre-resolved games (fast path)
- [ ] `npm run build` + `npm run lint` pass
- [ ] Full end-to-end: admin creates game → quick onboard → publish → user adds to library → generate playlist

---

## Milestone Dependency Graph

```
M1 (Schema)              ✅ DONE
 └─ M2 (Phased Actions)  ✅ DONE
     └─ M3 (Catalog Mgmt)  partial — metadata editing done, bulk ops + game creation remain
         └─ M4 (Published Gate)    ← behavioral change for users
             └─ M5 (Cleanup)
```

Each milestone is independently shippable. The user-visible change happens at M4. Everything before is additive and backward-compatible.

---

## Key Files Changed (M1 + M2)

### New files

| File                                            | Purpose                                                 |
| ----------------------------------------------- | ------------------------------------------------------- |
| `src/lib/pipeline/youtube-resolve.ts`           | Extracted `discoverOSTPlaylist` + `ensureVideoMetadata` |
| `src/components/backstage/PhaseStepper.tsx`     | Visual breadcrumb component                             |
| `src/app/api/backstage/load-tracks/route.ts`    | SSE route for track loading phase                       |
| `src/app/api/backstage/resolve/route.ts`        | SSE route for video resolution phase                    |
| `src/app/api/backstage/publish/route.ts`        | JSON route for publish toggle                           |
| `src/app/api/backstage/quick-onboard/route.ts`  | SSE route for full pipeline                             |
| `src/app/api/backstage/games/[gameId]/route.ts` | PATCH route for game metadata                           |

### Modified files

| File                                                                | Changes                                                                                                                                            |
| ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/types/index.ts`                                                | `OnboardingPhase` enum (no `Published`), `Game` interface (+`published`, +`thumbnail_url`, -`playtime_minutes`), `NoTracklistSource` review reason |
| `src/lib/db/schema.ts`                                              | `onboarding_phase`, `published`, `thumbnail_url` columns; dropped `playtime_minutes`                                                               |
| `src/lib/db/mappers.ts`                                             | Updated `toGame()` for new fields                                                                                                                  |
| `src/lib/db/repos/games.ts`                                         | `setPhase()`, `setPublished()`, `listPublished()`, expanded `update()`, `thumbnail_url` in create/import                                           |
| `src/lib/db/repos/tracks.ts`                                        | `deleteByKeys()` cascades to `video_tracks`                                                                                                        |
| `src/lib/db/repos/review-flags.ts`                                  | Added `dismiss(flagId, gameId)` for single flag removal                                                                                            |
| `src/lib/pipeline/onboarding.ts`                                    | Split into `loadTracks`, `tagGameTracks`, `resolveVideos`, `quickOnboard`                                                                          |
| `src/lib/pipeline/candidates.ts`                                    | Imports from `youtube-resolve.ts`                                                                                                                  |
| `src/lib/services/discogs.ts`                                       | `fetchDiscogsRelease()`, `fetchDiscogsMaster()`, graceful error handling, `sourceType` in results                                                  |
| `src/lib/events.ts`                                                 | `GameStatusPayload.phase` (was `.status`)                                                                                                          |
| `src/app/api/backstage/retag/route.ts`                              | Sets phase to Tagged on completion                                                                                                                 |
| `src/app/api/backstage/reingest/route.ts`                           | Uses composable `loadTracks` + `tagGameTracks`                                                                                                     |
| `src/app/api/backstage/review-flags/route.ts`                       | Supports single flag dismiss                                                                                                                       |
| `src/app/(backstage)/backstage/games/[slug]/page.tsx`               | Passes `videoMap` to client                                                                                                                        |
| `src/app/(backstage)/backstage/games/[slug]/game-detail-client.tsx` | Complete redesign: 3-zone controls, PhaseStepper, metadata editor, track editing, publish toggle                                                   |
