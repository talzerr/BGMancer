# BGMancer Heuristic Pipeline — Work Document

This document is the single source of truth for rebuilding the BGMancer playlist generation pipeline into a full Recommendation System architecture. A new agent can read this document and begin implementation immediately without any additional context.

---

## 1. Current State (Post-M1)

### What exists today

M0 (Schema Foundation) and M1 (Schema Cleanup + Tracks Repo + Discogs Service) are committed. The generation pipeline (`src/lib/pipeline/index.ts`) has three phases plus an optional Vibe Check step, but Phase 2 is a stub (tags all tracks with defaults):

**Phase 1** — YouTube OST playlist discovery per game. Searches YouTube for the game's official OST playlist, stores the playlist ID in `game_yt_playlists` (cached). Then fetches all video items from that playlist.

**Phase 2 (stub)** — The old LLM tagger (`tagger.ts`) was deleted in M0. `candidates.ts` currently passes all YouTube tracks through with default tags (`energy: 2, role: ambient, moods: [], instrumentation: [], hasVocals: false`). Marked `TODO M2`.

**Vibe Check (optional, Maestro tier only)** — `casting.ts` builds a candidate pool of ~2.5× target count tracks, weighted by game curation mode. `vibe-check.ts` sends this pool to the LLM with the session context. The LLM scores each track 1–100 as `fitScore`. On parse failure or Bard tier, returns an empty map and the Director falls back to tag-only scoring. **To be replaced by Vibe Profiler (M9).**

**Phase 3** — TypeScript Director (`director.ts`). Assembles the final playlist:

- Expands the arc template into per-slot requirements (6 phases: intro/rising/peak/valley/climax/outro)
- For each slot: `scoreTrack(track, slot, vibeScore?)`:
  - Hard energy filter: rejects tracks outside slot's energy range → `-Infinity`
  - **When vibeScore present**: `score = fitScore` (1–100) + 5 if role matches slot — fitScore is the PRIMARY signal
  - **When no vibeScore**: `score = 50` (neutral) + 5 if role matches slot
- `pickBestTrack` → **pure greedy** — picks the single highest-scoring track. No randomisation at this level.
- Game budgets, back-to-back avoidance, and focus game guarantees are all handled by `assemblePlaylist`.

### LLM providers

`src/lib/llm/index.ts` exports:

- `getTaggingProvider(tier)` → Anthropic (Maestro) or Ollama (Bard)
- `getVibeCheckProvider(tier)` → Anthropic if Maestro + `ANTHROPIC_API_KEY` set, otherwise `null` (signals orchestrator to skip Vibe Check entirely)
- `getCandidatesProvider` → deprecated alias for `getTaggingProvider`

### Current problems

- **No track metadata at all.** The tagger stub in `candidates.ts` assigns every track `energy: 2, role: ambient` — the Director has zero signal to work with.
- **Junk filtering is gone.** Without the tagger, 10-hour loops and compilation videos pass through unfiltered.
- **No onboarding.** Games are added with `tagging_status: 'pending'` but nothing drives them to `'ready'`.
- The Vibe Check is Maestro-only and produces opaque `fitScore` integers that cannot be inspected or tuned.
- `moodHint` is hardcoded `null` — the Vibe Check always runs in "no specific mood" mode.
- No visual indication in the UI that a game's tracks have been indexed and are ready to use.
- No admin surface for reviewing or correcting track metadata.

### Files to understand before starting

| File                             | Role                                                                     |
| -------------------------------- | ------------------------------------------------------------------------ |
| `src/lib/pipeline/index.ts`      | Entry point — orchestrates all phases + Vibe Check                       |
| `src/lib/pipeline/candidates.ts` | Phase 1 (YouTube discovery) + Phase 2 stub (default tags, TODO M2)       |
| `src/lib/pipeline/director.ts`   | Phase 3: arc assembly, `assemblePlaylist`, `scoreTrack`, `pickBestTrack` |
| `src/lib/pipeline/vibe-check.ts` | LLM session scorer → `Map<videoId, VibeScore>` (to be replaced by M9)    |
| `src/lib/pipeline/casting.ts`    | Builds vibe check candidate pool at ~2.5× target (to be deleted in M7)   |
| `src/lib/db/schema.ts`           | All table definitions (includes `tracks`, `video_tracks` from M0)        |
| `src/app/api/games/route.ts`     | CRUD for game library                                                    |
| `src/types/index.ts`             | All shared types incl. `TaggedTrack`, `Track`, `VibeScore`               |
| `src/lib/constants.ts`           | All tuning constants                                                     |
| `src/lib/llm/index.ts`           | Provider resolution (Bard → Ollama, Maestro → Anthropic)                 |

### Key types (current)

```typescript
enum TaggingStatus { Pending, Indexing, Ready, Failed }
enum TrackMood     { Epic, Tense, Peaceful, ... }        // 15 values
enum TrackInstrumentation { Orchestral, Synth, ... }     // 15 values
enum TrackRole     { Opener, Ambient, Build, ... }       // 7 values

interface Game {
  id: string;
  title: string;
  allow_full_ost: boolean;
  curation: CurationMode;
  steam_appid: number | null;
  playtime_minutes: number | null;
  tagging_status: TaggingStatus;
  tracklist_source: string | null;   // ← M1: where tracklist was imported from (e.g. "discogs")
  needs_review: boolean;             // ← M1: curator flag for manual review in Backstage
  created_at: string;
  updated_at: string;
}

interface Track {
  gameId: string;
  name: string;
  position: number;
  energy: 1 | 2 | 3 | null;
  role: TrackRole | null;
  moods: TrackMood[];
  instrumentation: TrackInstrumentation[];
  hasVocals: boolean | null;
  taggedAt: string | null;
}

interface TaggedTrack {
  videoId: string;
  title: string;
  channelTitle: string;
  thumbnail: string;
  gameId: string;
  gameTitle: string;
  cleanName: string;
  energy: 1 | 2 | 3;
  role: TrackRole;
  isJunk: boolean;
  moods: TrackMood[];
  instrumentation: TrackInstrumentation[];
  hasVocals: boolean;
}

interface VibeScore {
  fitScore: number; // 1–100 — to be removed in M7
}
```

### Key constants (current)

```
TAG_BATCH_SIZE          = 25    LLM tagging batch size
TAG_POOL_MAX            = 80    Max tracks per game sent to tagger
CASTING_POOL_MULTIPLIER = 2.5   Vibe Check candidate pool multiplier (to be removed M7)
VIBE_RECENTLY_PLAYED_LIMIT      Max recent track names passed to Vibe Check (to be removed M7)
```

### DB schema (current — relevant tables)

```sql
games (id, title, allow_full_ost, curation, steam_appid, playtime_minutes,
       tagging_status, tracklist_source, needs_review, created_at, updated_at)

tracks (game_id, name, position, energy, role, moods,
        instrumentation, has_vocals, tagged_at)
-- PK: (game_id, name)
-- Notes: clean track names from source (Discogs, manual, etc); all metadata is nullable until tagged

video_tracks (video_id, game_id, track_name, aligned_at)
-- PK: (video_id, game_id)
-- FK: (game_id, track_name) → tracks(game_id, name)
-- Notes: aligns raw YouTube videos to track names (null = junk)

game_yt_playlists (game_id, user_id, playlist_id, discovered_at)
-- PK: (game_id, user_id)
```

---

## 2. Design Principles

1. **Universal Schema = Source of Truth.** The `tracks` table holds all track metadata regardless of origin. No source-specific columns (`mb_release_id`, `mb_recording_id` removed in M1). A generic `tracklist_source TEXT` column on `games` records where the tracklist was imported from (e.g. `"discogs"`, `"manual"`, `"vgmdb"`). The app never couples to any external data source. The source is game-level (not per-track) because curator edits and re-ingests the entire tracklist as a unit.

2. **70/30 Heuristic Split.** The automated LLM tagger gets roughly 70% of tags right on the first pass. A `needs_review INTEGER DEFAULT 0` flag on `games` marks games where the curator should review or correct the tracklist (e.g., tracks in the wrong language, source mismatch). The Backstage admin page (M4) surfaces these for manual correction. Game-level flag enables curator to request reimport by changing `tracklist_source`.

3. **Power Law of Video Game Music.** The top 200–500 games (Final Fantasy, Zelda, Skyrim, Halo, Persona, etc.) will drive 90% of user queries. The head is manually verified and perfected via Backstage. The tail (thousands of obscure indie titles) runs on automated accuracy — if an energy tag is slightly off for an obscure game, the stakes are very low.

4. **Source-Agnostic Ingestion.** Discogs is the primary ingestion tool today (built-in `genre: Stage & Screen` + `style: Video Game Music` filtering). The architecture allows adding VGMdb, MusicBrainz, or manual entry later — each writes to the same `tracks` table with a different `source` value.

5. **Onboarding = Ingestion Time.** Track data is fetched when a game is added (not in a bulk script). This keeps the experience responsive: add a game, its tracks appear in the background.

6. **Backstage = Manual Override Layer.** An admin page for reviewing tracks, editing names, correcting tags, and triggering re-tagging. Filtered by `needs_review`. This is the critical piece that makes the 70/30 split viable at scale.

---

## 3. Target Architecture

The system transitions from an LLM-as-assembler to a classical Recommendation System with strict separation of concerns:

- **LLM** → only generates metadata (tagging), performs fuzzy matching (alignment), and session profiling (rubric). Never makes structural decisions.
- **Deterministic code** → all scoring, constraint enforcement, and playlist assembly.
- **Music Identity** is decoupled from **Audio Source**: a track in the `tracks` table (e.g. "Mantis Lords") is the entity that owns metadata; a YouTube video ID is just a pointer to it via `video_tracks`.

### Data flow

```
GAME ONBOARDING (eager, on game-add, fires in M3)
  ├─ Discogs API → tracklist (pristine names, track order)
  │                 stored in `tracks` table, games.tracklist_source = 'discogs:12345'
  ├─ LLM Tagger → tags stored on `tracks` rows
  │                energy · role · moods · instrumentation · has_vocals · tagged_at
  │                games.needs_review = 1 if LLM detects low confidence
  └─ games.tagging_status = 'ready'

  Fallback: no Discogs match → tagging_status = 'ready' anyway
            (legacy YouTube-title path at generation time)

BACKSTAGE (manual, admin page at /backstage, UI added in M4)
  ├─ View game tracklist + tags + tracklist_source
  ├─ Edit track names, correct tags
  ├─ Filter by needs_review = 1 (curator finds problematic games)
  ├─ Edit games.tracklist_source → triggering re-ingest (change source, retry Discogs)
  ├─ Trigger re-tagging for a game (clear tags, re-LLM)
  └─ Add/remove/edit tracks manually

CURATION PIPELINE (on Generate)
  Phase 1:   YouTube playlist discovery (unchanged, cached)
  Phase 1.5: Audio Alignment (LLM)
               YouTube raw titles → track names (or null = junk)
               cached in video_tracks
  Phase 2:   Vibe Profiler (LLM, optional)
               session history + mood hint → ScoringRubric
  Phase 3:   Heuristic Director (deterministic)
               arc template + rubric → weighted scoring → weighted-random top-N
```

### Legacy fallback (no Discogs match)

When Discogs finds no soundtrack for a game, `tagging_status` is set to `'ready'` anyway. During generation, `fetchGameCandidates` checks `Tracks.hasData(gameId)`. If false, it falls through to the existing YouTube-based stub path (default tags). The legacy path should be upgraded to produce `moods`, `instrumentation`, and `hasVocals` in a future milestone.

---

## 4. Milestones

### Dependencies

```
M0 ✅ → M1 ✅ → M2 → M3 → M4
                 M3 → M5
                 M1 → M6 → M7
                        M7 → M8
                        M8 → M9
```

Execute in order: **M0 ✅, M1 ✅, M2 (next), M3, M4, M5, M6, M7, M8, M9**

---

### M0 — Schema Foundation ✅ DONE

**What was built**

All new DB tables and types. Several design decisions were made during implementation that deviate from the original spec — those are the authoritative decisions going forward.

**Design decisions made**

1. **`track_tags` eliminated entirely.** Consolidated to a single track metadata table (`tracks`). All games use the same path. This removes the dual code path entirely.

2. **No migration system.** No `ALTER TABLE`. All schema changes go directly in `CREATE TABLE` definitions in `schema.ts` and are applied with `npm run db:reset`.

3. **Naming cleaned up.** `canonical_tracks` → `tracks`. `track_alignment` → `video_tracks`. `canonical_name` column → `track_name`. `CanonicalTrack` type → `Track`.

4. **FK constraint on `video_tracks.track_name`.** `FOREIGN KEY (game_id, track_name) REFERENCES tracks(game_id, name)` enforces that every alignment row points to a real track row. `NULL` track_name is still allowed (signals junk).

5. **All named value sets are enums.** `TrackMood`, `TrackInstrumentation`, `TrackRole`, `TaggingStatus` are all TypeScript enums (not literal union types).

6. **Legacy tagger deleted.** `src/lib/pipeline/tagger.ts` and `src/lib/db/repos/track-tags.ts` are gone. `fetchGameCandidates` has a stub that passes YouTube tracks through with default tags (`TODO M2`) so generation remains functional.

**Actual schema (final)**

```sql
games          -- added: tagging_status, mb_release_id (mb_release_id to be removed in M1)
tracks         -- new: (game_id, name) PK, mb_recording_id (to be removed in M1), energy, role, moods, instrumentation, has_vocals, tagged_at
video_tracks   -- new: (video_id, game_id) PK, track_name (FK → tracks), aligned_at
```

---

### M1 — Schema Cleanup + Tracks Repo + Discogs Service ✅ DONE

**What was built**

Three tightly coupled deliverables: schema cleanup (remove source-specific columns), a `Tracks` repository, and a Discogs HTTP client.

**1. Schema cleanup**

✅ **Complete**

`src/lib/db/schema.ts`:

- `games`: removed `mb_release_id TEXT`, added `tracklist_source TEXT` + `needs_review INTEGER NOT NULL DEFAULT 0`
- `tracks`: removed `mb_recording_id TEXT` + `source` and `needs_review` (both moved to game level)

`src/types/index.ts`:

- `Game`: removed `mb_release_id`, added `tracklist_source: string | null` + `needs_review: boolean`
- `Track`: removed `mbRecordingId`, `source`, `needsReview` — clean metadata-only type

`src/lib/db/mappers.ts`:

- `toGame`: removed `mb_release_id` parsing, added `tracklist_source` and `needs_review` parsing
- Added `toTrack(row)` and `toTracks(rows)` with JSON array parsing for moods/instrumentation, enum validation, integer→bool coercion

**Design decision**: `tracklist_source` and `needs_review` are **game-level**, not track-level. Rationale: the curator in Backstage edits the source and reruns ingestion for the entire tracklist as a unit. A single source describes where the full tracklist came from (e.g., `"discogs:12345"`). `needs_review` flags the entire game as needing curator attention (e.g., tracks in wrong language). This is a backstage UX pattern — curator sees `needs_review = true`, changes source, re-ingests.

**2. Tracks repo** ✅ **Complete**

`src/lib/db/repos/tracks.ts` created with all 6 methods:

```typescript
export const Tracks = {
  getByGame(gameId: string): Track[]
  upsertBatch(tracks: Array<{ gameId: string; name: string; position: number }>): void
  hasData(gameId: string): boolean
  isTagged(gameId: string): boolean
  updateTags(gameId: string, name: string, tags: {
    energy: number; role: string; moods: string; instrumentation: string; hasVocals: boolean;
  }): void
  clearTags(gameId: string): void
}
```

Exported from `src/lib/db/repo.ts`.

**3. Discogs service** ✅ **Complete**

`src/lib/services/discogs.ts` — HTTP client for Discogs API with:

- Two-call flow: search (stage/screen vgm filter) → get release tracklist
- Auth via `DISCOGS_TOKEN` env var (personal access token, 60 req/min auth | 25 req/min unauth)
- Rate limiting: reads `X-Discogs-Ratelimit-Remaining` header, sleeps 61s if ≤ 2
- User-Agent: `BGMancer/1.0 +https://github.com/talzerr/bgmancer`
- Best result selection: prefers `File`/`CD` format, then highest `community.have` count
- Returns `{ tracks: [...], releaseTitle: string } | null`

Added `DISCOGS_TOKEN` to `.env.local.example`.

**Verification** ✅ **Passed**

```bash
✓ Schema changes applied via npm run db:reset
✓ Full build + lint: zero errors
✓ searchGameSoundtrack('Hollow Knight') → 28 tracks, clean names
✓ searchGameSoundtrack('zzznonexistentgame999') → null
✓ Games.update supports tracklist_source and needs_review
```

---

## Ready for M2 — LLM Tagger

The schema is now clean and source-agnostic. The Tracks repo is ready to receive batch inserts from Discogs. The Discogs client delivers pristine track names with positions. M2 builds the LLM tagger that consumes this data and populates `energy`, `role`, `moods`, `instrumentation`, `hasVocals`, and `tagged_at` on the `tracks` rows. The tagger will run as part of the onboarding pipeline (M3).

---

### M2 — LLM Tagger

**What to build**

A new tagger that operates on pristine track names from the `tracks` table. Key differences from the deleted `tagger.ts`:

- **Input**: clean names from `tracks` table — no cleaning needed
- **Output**: energy, role, moods (1–3), instrumentation (1–3), hasVocals, needsReview — **no** `cleanName`, **no** `isJunk`
- Tags stored directly on `tracks` rows via `Tracks.updateTags`
- Batch + cache pattern: skip rows where `tagged_at IS NOT NULL`
- Sets `needs_review = 1` when confidence is low (LLM signals this via a `confident` boolean, or heuristic: track name is very short/generic like "Track 01")

**`src/lib/pipeline/tagger.ts`** (new file, replacing the deleted one)

```typescript
export async function tagTracks(
  gameId: string,
  gameTitle: string,
  tracks: Track[],
  provider: LLMProvider,
): Promise<void>;
// Persists energy, role, moods, instrumentation, hasVocals, needsReview
// to tracks via Tracks.updateTags
```

The LLM prompt:

```
You are a Video Game Music metadata tagger. Given a game title and its official track names,
return structured metadata for each track.

Output ONLY a valid JSON array. Each element:
{ "index": <1-based>, "energy": <1|2|3>, "role": "<role>", "moods": [...],
  "instrumentation": [...], "hasVocals": <boolean>, "confident": <boolean> }

Fields:
- energy: 1=calm/ambient, 2=moderate/exploration, 3=intense/combat/boss
- role: one of "opener", "ambient", "build", "combat", "closer", "menu", "cinematic"
- moods: 1-3 from: epic, tense, peaceful, melancholic, triumphant, mysterious, playful, dark,
         ethereal, heroic, nostalgic, ominous, serene, chaotic, whimsical
- instrumentation: 1-3 from: orchestral, synth, acoustic, chiptune, piano, rock, metal,
                   electronic, choir, ambient, jazz, folk, strings, brass, percussion
- hasVocals: true if the track has singing/vocals
- confident: false if you are guessing based on the name alone and cannot determine
             the track's character with reasonable certainty
```

**Key files**

| File                         | Action |
| ---------------------------- | ------ |
| `src/lib/pipeline/tagger.ts` | Create |

**How to verify**

After running the tagger on a game with Discogs data:

```bash
sqlite3 bgmancer.db "SELECT name, energy, role, moods, needs_review FROM tracks WHERE game_id = '<id>' LIMIT 10"
```

Expect: `moods` = a JSON array like `["peaceful","mysterious"]`, `energy` 1/2/3, `needs_review` = 0 for obvious tracks (e.g. "Boss Battle"), 1 for ambiguous ones.
Re-run on same game → no duplicate LLM calls (cache works via `tagged_at`).

---

### M3 — Game Onboarding Pipeline

**What to build**

The fire-and-forget indexer triggered when a game is added. Drives `tagging_status` through its lifecycle. Never throws — errors are caught, status set to `'failed'`.

**`src/lib/pipeline/onboarding.ts`** (new file)

```typescript
export async function onboardGame(game: Game, tier: UserTier): Promise<void> {
  // 1. Set status → 'indexing'
  // 2. searchGameSoundtrack(game.title)  // Discogs
  // 3a. If found:
  //     - Tracks.upsertBatch(tracks)  // pristine names + positions
  //     - tagTracks(game.id, game.title, tracks, provider)
  //     - Games.update(id, { tracklist_source: 'discogs:<releaseId>', needs_review: <llm signal> })
  //     - Games.setStatus(game.id, 'ready')
  // 3b. If not found:
  //     - Games.setStatus(game.id, 'ready')  ← legacy path at generation time
  //     - log: "[onboard] No Discogs data for <title>, falling back to legacy path"
  // On any throw:
  //     - Games.setStatus(game.id, 'failed')
  //     - console.error(...)
}
```

**`src/lib/db/repos/games.ts`**

Add: `Games.setStatus(gameId: string, status: TaggingStatus): void`

**`src/app/api/games/route.ts`** — update POST handler

```typescript
const user = Users.getOrCreate(userId);
const game = Games.create(userId, id, body.title.trim(), CurationMode.Include, steamAppid);
void onboardGame(game, user.tier); // fire-and-forget
return NextResponse.json(game, { status: 201 });
```

**`src/app/api/steam/import/route.ts`** — trigger `onboardGame` for each newly imported game, sequentially with delay to respect Discogs rate limiting.

**Key files**

| File                                | Action                                    |
| ----------------------------------- | ----------------------------------------- |
| `src/lib/pipeline/onboarding.ts`    | Create                                    |
| `src/lib/db/repos/games.ts`         | Modify — add `setStatus`                  |
| `src/app/api/games/route.ts`        | Modify — wire onboarding into POST        |
| `src/app/api/steam/import/route.ts` | Modify — wire onboarding into bulk import |

**How to verify**

```bash
# Start dev server, add a game:
curl -X POST http://localhost:6959/api/games \
  -H 'Content-Type: application/json' \
  -d '{"title": "Hollow Knight"}'

# Poll the game status:
watch -n 2 'sqlite3 bgmancer.db "SELECT title, tagging_status FROM games"'
# Should see: pending → indexing → ready

# Confirm tracks were created:
sqlite3 bgmancer.db "SELECT COUNT(*) FROM tracks WHERE game_id = '<id>'"

# Confirm tags were applied:
sqlite3 bgmancer.db "SELECT name, energy, role, moods, source, needs_review FROM tracks WHERE game_id = '<id>' LIMIT 5"
```

---

### M4 — Backstage Admin Page

> **Full design document: [`BACKSTAGE_DESIGN.md`](./BACKSTAGE_DESIGN.md)**
>
> The Backstage is a standalone feature with its own information architecture, component library, API surface, and security model. The design doc covers all of this in detail. This section summarizes the scope and key deliverables.

**What to build**

An admin control plane at `/backstage` for inspecting, editing, and correcting track metadata. Two-level architecture:

- **Game Index** (`/backstage`) — high-density table of all games with aggregate stats (track count, tagged count, tracklist_source). Filtered by `needs_review` to show high-priority items. Sorted by review flag descending (flagged first). Health dashboard summary bar.
- **Game Detail** (`/backstage/[gameId]`) — per-game control: edit `tracklist_source` (trigger re-ingest), toggle `needs_review`, and track table with inline name editing, slide-over drawer for tag editing, bulk selection with floating action bar, and SSE-streamed re-tag/re-ingest operations.

**Key capabilities**

- **Data Explorer**: filterable tables, validation flags (conflicting tags like `combat + energy:1`), tag distribution summary
- **Orchestrator**: re-ingest (Discogs), re-tag (LLM), add/delete tracks — all with confirmation modals, SSE progress
- **Editor**: inline name edit, drawer tag edit, bulk tag updates, one-click review toggle

**Key files**

| File                                                   | Action |
| ------------------------------------------------------ | ------ |
| `src/app/backstage/page.tsx`                           | Create |
| `src/app/backstage/backstage-client.tsx`               | Create |
| `src/app/backstage/[gameId]/page.tsx`                  | Create |
| `src/app/backstage/[gameId]/game-detail-client.tsx`    | Create |
| `src/app/api/backstage/games/route.ts`                 | Create |
| `src/app/api/backstage/games/[gameId]/tracks/route.ts` | Create |
| `src/app/api/backstage/tracks/route.ts`                | Create |
| `src/app/api/backstage/retag/route.ts`                 | Create |
| `src/app/api/backstage/reingest/route.ts`              | Create |
| `src/components/backstage/BackstageTable.tsx`          | Create |
| `src/components/backstage/TagBadge.tsx`                | Create |
| `src/components/backstage/TrackDrawer.tsx`             | Create |
| `src/components/backstage/ConfirmModal.tsx`            | Create |
| `src/components/backstage/ProgressBar.tsx`             | Create |
| `src/components/backstage/FilterBar.tsx`               | Create |

**How to verify**

1. Open `/backstage`. See games ranked by needs_review count. Summary bar shows correct totals.
2. Click a game → Game Detail view. See track table with all columns.
3. Click a track name → inline edit. Change it, press Enter → persists on refresh.
4. Click a track row → drawer opens. Edit energy/role/moods → Save → persists.
5. Select multiple rows → floating action bar. Bulk set energy → all selected rows update.
6. Click "Re-tag" → confirmation modal → SSE progress bar → tags cleared and re-populated.
7. Toggle "Needs review only" filter → only flagged tracks visible.

---

### M5 — Game Status UI

**What to build**

Visual per-game readiness indicator in the Library. The Generate button becomes context-aware.

**`src/app/library/library-client.tsx`**

Add a status badge next to each game in the list:

- `'pending'` or `'indexing'` → small spinner + grey text "Indexing…"
- `'ready'` → no badge (clean default, silence = success)
- `'failed'` → warning icon + amber text "Index failed" with a tooltip explaining the legacy fallback is still active

**`src/hooks/useGameLibrary.ts`**

Add a polling effect: when any game in the library has `tagging_status === 'indexing'`, re-fetch the games list every 3 seconds. Stop polling when none are `'indexing'`.

**`src/components/GenerateSection.tsx`**

The Generate button should be disabled with a clear message when any non-skip game is not yet `'ready'`:

```
Disabled states:
  - "2 games are still being indexed…"   (when status = 'indexing')
  - "1 game failed to index — generation may be limited"  (when status = 'failed', softer — still allows generate)
```

Decision: `'failed'` games are degraded (legacy path) but should not hard-block generation. Only `'indexing'` hard-blocks.

**Key files**

| File                                 | Action |
| ------------------------------------ | ------ |
| `src/app/library/library-client.tsx` | Modify |
| `src/hooks/useGameLibrary.ts`        | Modify |
| `src/components/GenerateSection.tsx` | Modify |
| `src/app/feed-client.tsx`            | Modify |

**How to verify**

1. Add a game → spinner appears in Library.
2. Generate button shows "1 game is still being indexed…" and is disabled.
3. After indexing completes → spinner gone, Generate re-enabled.
4. A game that failed shows a warning badge but does not prevent generation.

---

### M6 — Audio Alignment

**What to build**

A new pipeline step that maps raw YouTube video titles to track names in the `tracks` table. Replaces name-cleaning entirely. `null` alignment = junk. Results cached in `video_tracks`.

**`src/lib/pipeline/aligner.ts`** (new file)

```typescript
export async function alignVideosToTracks(
  videos: OSTTrack[],
  tracks: Track[],
  gameTitle: string,
  provider: LLMProvider,
): Promise<Map<string, string | null>>;
// Returns: Map<videoId, trackName | null>
// null = junk (10-hour loops, interviews, duplicate variants, non-music)
```

LLM prompt structure: provide the tracklist as the "answer key" — the model's task is to match each raw YouTube title to the closest entry or `null`. This is fundamentally easier than open-ended name cleaning because the model has the correct answer set.

Cache-first pattern:

1. Check `video_tracks` for all video IDs
2. Only call LLM for uncached videos
3. Upsert results to `video_tracks`

**`src/lib/db/repos/video-tracks.ts`** (new file)

```typescript
export const VideoTracks = {
  getByVideoIds(videoIds: string[], gameId: string): Map<string, string | null>
  upsertBatch(rows: Array<{ videoId: string; gameId: string; trackName: string | null }>): void
}
```

**Key files**

| File                               | Action                          |
| ---------------------------------- | ------------------------------- |
| `src/lib/pipeline/aligner.ts`      | Create                          |
| `src/lib/db/repos/video-tracks.ts` | Create                          |
| `src/lib/db/repo.ts`               | Modify — add VideoTracks export |

**How to verify**

```bash
# After running alignment on a game with track data:
sqlite3 bgmancer.db "SELECT video_id, track_name FROM video_tracks WHERE game_id = '<id>' LIMIT 10"
# Expect: real track names for music videos, NULL for junk

# Second run on same videos = no LLM calls (cache hit)
```

---

### M7 — Pipeline Integration

**What to build**

Wire tracks + audio alignment into `fetchGameCandidates`. Delete old Vibe Check / Casting. The `TaggedTrack` type is the unified output — only the source of its metadata changes.

**`src/lib/pipeline/candidates.ts`** — update `fetchGameCandidates`

```
if Tracks.hasData(gameId):
  Phase 1: YouTube discovery (unchanged)
  Phase 1.5: alignVideosToTracks(ytTracks, tracks, gameTitle, provider)
             → filter out null-aligned videos
  Build TaggedTrack[] by joining:
    - YouTube metadata (videoId, title, channelTitle, thumbnail)
    - tracks row matched by alignment (cleanName=name, energy, role, moods, instrumentation, hasVocals)
  Return { kind: 'tagged', game, tracks: TaggedTrack[] }
else:
  existing legacy stub (unchanged)
```

**Files to delete**

- `src/lib/pipeline/vibe-check.ts` — replaced by Vibe Profiler (M9)
- `src/lib/pipeline/casting.ts` — was only used by vibe-check

**Also remove**

- `VibeScore` interface from `src/types/index.ts`
- `getVibeCheckProvider` from `src/lib/llm/index.ts`
- `CASTING_POOL_MULTIPLIER`, `VIBE_RECENTLY_PLAYED_LIMIT` from `src/lib/constants.ts`
- All imports of the above in `src/lib/pipeline/index.ts`

**Update `assemblePlaylist` signature**: Remove `vibeScores` parameter (and `VibeScore` from `scoreTrack` / `pickBestTrack`). Score is now purely tag-based with baseline 50 + role bonus.

**Key files**

| File                             | Action                                    |
| -------------------------------- | ----------------------------------------- |
| `src/lib/pipeline/candidates.ts` | Modify — add tracks path                  |
| `src/lib/pipeline/index.ts`      | Modify — remove vibe check block          |
| `src/lib/pipeline/director.ts`   | Modify — remove VibeScore from signatures |
| `src/lib/pipeline/vibe-check.ts` | Delete                                    |
| `src/lib/pipeline/casting.ts`    | Delete                                    |
| `src/types/index.ts`             | Modify — remove VibeScore                 |
| `src/lib/llm/index.ts`           | Modify — remove getVibeCheckProvider      |
| `src/lib/constants.ts`           | Modify — remove vibe check constants      |

**How to verify**

1. Generate a playlist for a game with track data → track names are pristine (no YouTube noise).
2. Junk videos absent from playlist.
3. Generate for a game without track data → still works via legacy stub.
4. `npm run build && npm run lint` pass.

---

### M8 — Enhanced Director Scoring

**What to build**

Upgrade `scoreTrack` from a trivial placeholder to a full weighted additive scorer. The arc template gains per-phase emotional profiles used as a fallback rubric when no session rubric is available.

**`src/lib/constants.ts`** — add scoring weight constants

```typescript
export const SCORE_BASELINE = 50;
export const SCORE_ROLE_MATCH = 10;
export const SCORE_MOOD_MATCH = 8; // per mood (up to 3 = max +24)
export const SCORE_MOOD_PENALTY = 12; // per penalized mood
export const SCORE_INSTRUMENT_MATCH = 5; // per instrument (up to 2 = max +10)
export const SCORE_VOCALS_PENALTY = 15;
export const DIRECTOR_TOP_N_POOL = 5;
```

**`src/lib/pipeline/director.ts`** — extend `ArcSlot` and rewrite `scoreTrack`

Extend `ArcSlot` with `preferredMoods`, `penalizedMoods`, `preferredInstrumentation`.

Update `ARC_TEMPLATE` with per-phase emotional profiles:

| Phase  | Preferred Moods                   | Penalized Moods             | Preferred Instruments      |
| ------ | --------------------------------- | --------------------------- | -------------------------- |
| intro  | peaceful, mysterious, nostalgic   | chaotic, epic               | piano, ambient, strings    |
| rising | mysterious, tense, melancholic    | playful, whimsical          | orchestral, strings, synth |
| peak   | epic, tense, heroic               | peaceful, serene, whimsical | orchestral, rock, metal    |
| valley | peaceful, serene, melancholic     | epic, chaotic, heroic       | ambient, piano, acoustic   |
| climax | epic, heroic, triumphant, chaotic | peaceful, playful           | orchestral, metal, choir   |
| outro  | melancholic, nostalgic, peaceful  | chaotic, tense              | piano, acoustic, strings   |

Rewrite `scoreTrack(track, slot, rubric?)`:

```
score = SCORE_BASELINE
if track.energy not in slot.energyPrefs → return -Infinity

if track.role in slot.rolePrefs → score += SCORE_ROLE_MATCH
if rubric?.preferredRoles includes track.role → score += SCORE_ROLE_MATCH  // stacks

activeMoods    = rubric?.preferredMoods  ?? slot.preferredMoods
penalizedMoods = rubric?.penalizedMoods  ?? slot.penalizedMoods
for each mood in track.moods:
  if mood in activeMoods    → score += SCORE_MOOD_MATCH
  if mood in penalizedMoods → score -= SCORE_MOOD_PENALTY

activeInstruments = rubric?.preferredInstrumentation ?? slot.preferredInstrumentation
for each inst in track.instrumentation:
  if inst in activeInstruments → score += SCORE_INSTRUMENT_MATCH

if rubric?.allowVocals === false and track.hasVocals → score -= SCORE_VOCALS_PENALTY
```

Update `assemblePlaylist` signature to accept `rubric?: ScoringRubric` instead of `vibeScores`.

Replace greedy pick with top-N weighted random in `pickBestTrack`.

**`src/types/index.ts`** — add `ScoringRubric`

```typescript
export interface ScoringRubric {
  targetEnergy: Array<1 | 2 | 3>;
  preferredMoods: TrackMood[];
  penalizedMoods: TrackMood[];
  preferredInstrumentation: TrackInstrumentation[];
  penalizedInstrumentation: TrackInstrumentation[];
  allowVocals: boolean | null;
  preferredRoles: TrackRole[];
}
```

**Key files**

| File                           | Action                       |
| ------------------------------ | ---------------------------- |
| `src/lib/pipeline/director.ts` | Modify — rewrite scoring     |
| `src/lib/constants.ts`         | Modify — add scoring weights |
| `src/types/index.ts`           | Modify — add ScoringRubric   |

**How to verify**

1. Generate a 50-track playlist. Intro tracks should be calm/atmospheric; peak/climax should be intense.
2. Generate again → different playlist (weighted random).
3. Debug log `scoreTrack` to confirm score distribution.

---

### M9 — Vibe Profiler (LLM Rubric Generator)

**What to build**

Replaces the old per-track Vibe Check with a single structured `ScoringRubric`. The LLM answers "what kind of music should this session favor?" not "score each track."

**How it works**

1. **Deterministic pre-processing** (no LLM): load the user's most recent session's tracks from the DB, compute a plain-language summary of dominant patterns (e.g. "mostly peaceful + melancholic moods, orchestral + piano instrumentation, low energy, no vocals").

2. **LLM interpretation**: send the summary + optional `moodHint` + list of games being used to the LLM. Ask it to produce a structured `ScoringRubric` JSON.

The LLM is not picking tracks. It is only answering: _"Given this listening context, what kind of music should this session favor?"_

On any parse failure → return `null`. Do not throw. Director uses arc-implicit scoring as fallback.

Available to both tiers (Bard via Ollama, Maestro via Anthropic).

**`src/lib/pipeline/vibe-profiler.ts`** (new file)

```typescript
interface VibeContext {
  recentTracks: TaggedTrack[];
  moodHint: string | null;
  gameTitles: string[];
}

export async function generateRubric(
  ctx: VibeContext,
  provider: LLMProvider,
): Promise<ScoringRubric | null>;
```

**`src/lib/llm/index.ts`** — add provider

```typescript
export function getVibeProfilerProvider(tier: UserTier): LLMProvider {
  return providerForTier(tier, "ANTHROPIC_VIBE_PROFILER_MODEL");
}
```

**`src/lib/pipeline/index.ts`** — wire Phase 2

```typescript
// Between Phase 1.5 and Phase 3:
const rubric = await generateRubric(
  { recentTracks, moodHint: null, gameTitles: activeGames.map((g) => g.title) },
  vibeProvider,
);
const orderedTracks = assemblePlaylist(
  taggedPools,
  activeGames,
  assembleTarget,
  rubric ?? undefined,
);
```

`moodHint` is wired as `null` for now. Adding user-facing input for it is a future UI task.

**Key files**

| File                                | Action                               |
| ----------------------------------- | ------------------------------------ |
| `src/lib/pipeline/vibe-profiler.ts` | Create                               |
| `src/lib/llm/index.ts`              | Modify — add getVibeProfilerProvider |
| `src/lib/pipeline/index.ts`         | Modify — wire Phase 2                |
| `src/lib/constants.ts`              | Modify — add RUBRIC_HISTORY_LIMIT    |

**How to verify**

1. Generate twice. Log the rubric on second generation — it should reflect the first session's dominant moods/instruments.
2. Break the LLM call — generation still completes without rubric.

---

## 5. Invariants — What Must Always Be True

Across all milestones, these guarantees must hold:

1. **Generation never hard-fails due to onboarding state.** If `tagging_status = 'failed'`, the legacy path is used. If onboarding is mid-flight (`'indexing'`), the UI prevents generation, but the pipeline itself is still safe.
2. **`TaggedTrack` is the unified representation.** The source of its data (`tracks` table or legacy stub) is an internal detail. The Director always receives the same type.
3. **All DB writes are idempotent.** `upsertBatch` everywhere. `CREATE TABLE IF NOT EXISTS`. Re-running onboarding on an already-ready game is a no-op.
4. **LLM calls are always cached.** `tracks.tagged_at` caches tagging. `video_tracks` caches alignment. `game_yt_playlists` caches playlist discovery. No LLM call happens twice for the same input.
5. **`npm run build` and `npm run lint` pass after each milestone** with zero errors.
6. **The `tracks` table is source-agnostic.** All game-level metadata (`tracklist_source`, `needs_review`) lives on `games` row. Tracks are pure metadata (name, position, energy, role, moods, instrumentation, hasVocals, taggedAt).

---

## 6. Things to Delete

As part of M7, the following should be removed cleanly:

| File                             | Reason                         |
| -------------------------------- | ------------------------------ |
| `src/lib/pipeline/vibe-check.ts` | Replaced by Vibe Profiler (M9) |
| `src/lib/pipeline/casting.ts`    | Was only used by vibe-check    |

Also remove:

- `VibeScore` interface from `src/types/index.ts`
- `getVibeCheckProvider` from `src/lib/llm/index.ts`
- `CASTING_POOL_MULTIPLIER` constant from `src/lib/constants.ts`
- `VIBE_RECENTLY_PLAYED_LIMIT` constant from `src/lib/constants.ts` (replaced by `RUBRIC_HISTORY_LIMIT` in M9)
- All imports of the above in `src/lib/pipeline/index.ts`

---

## 7. Quick Reference — New Files

| File                                | Milestone | Purpose                                        |
| ----------------------------------- | --------- | ---------------------------------------------- |
| `src/lib/services/discogs.ts`       | M1        | Discogs API client                             |
| `src/lib/db/repos/tracks.ts`        | M1        | DB repo for tracks table                       |
| `src/lib/pipeline/tagger.ts`        | M2        | LLM tagger for clean track names               |
| `src/lib/pipeline/onboarding.ts`    | M3        | Game indexing orchestrator                     |
| `src/app/backstage/**`              | M4        | Backstage pages (see BACKSTAGE_DESIGN.md)      |
| `src/app/api/backstage/**`          | M4        | Backstage API routes (see BACKSTAGE_DESIGN.md) |
| `src/components/backstage/**`       | M4        | Backstage UI components                        |
| `src/lib/pipeline/aligner.ts`       | M6        | YouTube → track name alignment                 |
| `src/lib/db/repos/video-tracks.ts`  | M6        | DB repo for video_tracks                       |
| `src/lib/pipeline/vibe-profiler.ts` | M9        | LLM Vibe Profiler → ScoringRubric              |

---

## 8. Dev Server

```bash
npm run dev          # starts on port 6959 with Turbopack
npm run build        # must pass after every milestone
npm run lint         # ESLint — must pass after every milestone
npm run db:reset     # drops and recreates DB (run after schema changes)
npm run db:backup    # snapshot current DB
npm run db:restore   # restore from snapshot
```

SQLite DB file: `bgmancer.db` at project root. Connect with `sqlite3 bgmancer.db` for inspection.
