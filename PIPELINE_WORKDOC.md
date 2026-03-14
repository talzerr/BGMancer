# BGMancer Heuristic Pipeline — Work Document

This document is the single source of truth for rebuilding the BGMancer playlist generation pipeline into a full Recommendation System architecture. A new agent can read this document and begin implementation immediately without any additional context.

---

## 1. Current State (Post-M9 — branch ready to merge)

### What exists today

M0–M3, M5, M6, M7, M8, and M9 are committed. The generation pipeline (`src/lib/pipeline/index.ts`) has four phases.

**Phase 1 — YouTube OST Playlist Discovery** (`discoverOSTPlaylist`) — Uses the cached `yt_playlist_id` if present, otherwise searches YouTube and stores the result. Fetches all video items from the playlist.

**Phase 1.5 — Track Resolution + Duration Fetching** (`resolveCurated` / `resolveLegacy`) — For curated games: aligns DB track names to YouTube video IDs via the LLM resolver, reads pre-existing tags (`energy`, `roles`, `moods`, `instrumentation`, `hasVocals`), filters untagged tracks. For legacy games (no DB tags): assigns static stubs. Both paths call `ensureDurations` — fetches `duration_seconds` from YouTube for any video IDs not yet stored in `video_tracks`, stores them, returns a complete duration map. Every `TaggedTrack` exits this phase with `durationSeconds: number` (never null). Duration filter (`filterByDuration`) runs after candidate gathering, before the Director, so the Director only sees tracks that satisfy `allow_short_tracks` / `allow_long_tracks` config.

**Phase 2 — Vibe Profiler (Maestro only)** (`profileVibe`) — Single LLM call via `generateRubric()`. Takes active game titles, returns a `ScoringRubric` JSON. Skipped for Bard tier. On any failure generation continues without a rubric.

**Phase 3 — Deterministic Arc Assembly** (`runDirector`) — TypeScript Director (`director.ts`). Assembles the final playlist:

- Expands the arc template into per-slot requirements (6 phases: intro/rising/peak/valley/climax/outro). Each slot carries `energyPrefs`, `rolePrefs`, `preferredMoods`, `penalizedMoods`, `preferredInstrumentation`.
- For each slot: `scoreTrack(track, slot, rubric?)`:
  - Hard energy filter: rejects tracks outside slot's energy range → `-Infinity`
  - **Weighted Jaccard Resonance** across three dimensions:
    - Role (binary intersection): `track.roles ∩ slot.rolePrefs ≠ ∅` → 1.0, else 0.0. Weight: 0.40
    - Mood: Jaccard similarity between track moods and target moods. Weight: 0.35
    - Instrumentation: Jaccard similarity between track instruments and target instruments. Weight: 0.25
  - Penalty multipliers: 0.5× for penalized moods, 0.5× for vocals when `allowVocals: false`
  - Rubric (optional `ScoringRubric`) overrides mood/instrumentation targets exclusively (XOR, not merge); promotes extra preferred roles; adds to penalized mood set
- `pickBestTrack` → **top-N weighted random** (`DIRECTOR_TOP_N_POOL = 5`). Probability proportional to `score + 0.01`.
- Game budgets, same-game avoidance, and focus game guarantees handled by `assemblePlaylist`.

**Post-phase — Pending slot resolution** (`resolvePendingSlots`) — After the session is saved to DB, searches YouTube for any fallback tracks (full-OST games, games with no playlist found) that were saved as `pending` with `search_queries`. Updates DB and in-memory state in place.

### LLM providers

`src/lib/llm/index.ts` exports:

- `getTaggingProvider(tier)` → Anthropic (Maestro) or Ollama (Bard). Used by Phase 1.5 resolver for track alignment and auto-discovery.
- `getVibeProfilerProvider(tier)` → Anthropic (Maestro) or Ollama (Bard). Used by Phase 2 Vibe Profiler. Override model via `ANTHROPIC_VIBE_MODEL`.
- `getLocalLLMProvider()` → always Ollama.

### Current problems

- **No onboarding flow.** Games are added with `tagging_status: 'pending'` but nothing drives them to `'ready'` or invokes the resolver.
- **Legacy games with no curated tracks are second-class.** They use stubs and are labeled "limited quality" in progress events. No UI indication.
- **No admin surface** for reviewing or correcting track metadata, resolver confidence, or auto-discovered tracks.
- **Scoring is game-aware (Maestro) or arc-default (Bard).** M9 added session-level rubric generation via the Vibe Profiler.

### Files to understand before starting

| File                                | Role                                                                                                  |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `src/lib/pipeline/index.ts`         | Orchestrator — `gatherCandidates`, `filterByDuration`, `profileVibe`, `runDirector`, `persistSession` |
| `src/lib/pipeline/candidates.ts`    | Phase 1 + 1.5 — `discoverOSTPlaylist`, `ensureDurations`, `resolveCurated`, `resolveLegacy`           |
| `src/lib/pipeline/vibe-profiler.ts` | Phase 2 — `generateRubric()`, LLM prompt, validation                                                  |
| `src/lib/pipeline/resolver.ts`      | Phase 1.5: LLM batch alignment, auto-discovery, fallback search                                       |
| `src/lib/pipeline/director.ts`      | Phase 3: arc assembly, `assemblePlaylist`, `scoreTrack`, `pickBestTrack`                              |
| `src/lib/db/schema.ts`              | All table definitions                                                                                 |
| `src/lib/db/repos/video-tracks.ts`  | `getByGame`, `upsertBatch`, `storeDurations`                                                          |
| `src/types/index.ts`                | All shared types incl. `TaggedTrack`, `Track`, `ResolvedTrack`, `ScoringRubric`                       |
| `src/lib/constants.ts`              | All tuning constants                                                                                  |
| `src/lib/llm/index.ts`              | Provider resolution — `getTaggingProvider`, `getVibeProfilerProvider`, `getLocalLLMProvider`          |

### Key types (current)

```typescript
enum TaggingStatus { Pending, Indexing, Ready, Limited, Failed }
// Limited = onboarding completed but no Discogs data found (legacy YouTube-title path)
// Failed  = onboarding threw (network error, crash) — not a data quality signal
enum TrackMood     { Epic, Tense, Peaceful, ... }        // 15 values
enum TrackInstrumentation { Orchestral, Synth, ... }     // 15 values
enum TrackRole     { Opener, Ambient, Build, ... }       // 7 values

interface Game {
  id: string;
  title: string;
  curation: CurationMode;
  steam_appid: number | null;
  playtime_minutes: number | null;
  tagging_status: TaggingStatus;
  tracklist_source: string | null;   // ← M1: where tracklist was imported from (e.g. "discogs:12345")
  yt_playlist_id: string | null;     // ← Phase 1 cache: YouTube OST playlist ID (replaces game_yt_playlists table)
  needs_review: boolean;             // ← M1: curator flag for manual review in Backstage
  created_at: string;
  updated_at: string;
}

interface AppConfig {
  target_track_count: number;
  anti_spoiler_enabled: boolean;
  allow_long_tracks: boolean;
  allow_short_tracks: boolean;       // ← default true; when false, tracks < 90s excluded
}

interface Track {
  gameId: string;
  name: string;
  position: number;
  active: boolean;                // 1 = curation-eligible, 0 = excluded until Backstage activation
  energy: 1 | 2 | 3 | null;
  roles: TrackRole[];             // multi-role: up to 2 values, stored as JSON array in tracks.role column
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
  roles: TrackRole[];             // intersection-checked against slot.rolePrefs in Director
  isJunk: boolean;
  moods: TrackMood[];
  instrumentation: TrackInstrumentation[];
  hasVocals: boolean;
  durationSeconds: number;        // always set — ensureDurations fetches from YouTube if missing
}

interface ResolvedTrack {
  videoId: string;
  videoTitle: string;
  channelTitle: string;
  thumbnail: string;
  gameId: string;
  trackName: string;
  energy: 1 | 2 | 3 | null;
  roles: TrackRole[];
  moods: TrackMood[];
  instrumentation: TrackInstrumentation[];
  hasVocals: boolean | null;
}

interface ScoringRubric {
  targetEnergy: Array<1 | 2 | 3>;
  preferredMoods: TrackMood[];
  penalizedMoods: TrackMood[];
  preferredInstrumentation: TrackInstrumentation[];
  penalizedInstrumentation: TrackInstrumentation[];
  allowVocals: boolean | null;
  preferredRoles: TrackRole[];
}
```

### Key constants (current)

```
TAG_BATCH_SIZE             = 25    LLM tagging batch size
TAG_POOL_MAX               = 80    Max tracks per game sent to tagger

SCORE_WEIGHT_ROLE          = 0.40  Director: weight for role dimension (binary intersection)
SCORE_WEIGHT_MOOD          = 0.35  Director: weight for mood Jaccard similarity
SCORE_WEIGHT_INSTRUMENT    = 0.25  Director: weight for instrumentation Jaccard similarity
SCORE_PENALTY_MULTIPLIER   = 0.5   Director: score multiplier when penalized mood present
SCORE_VOCALS_PENALTY_MULTIPLIER = 0.5  Director: score multiplier when vocals disallowed
DIRECTOR_TOP_N_POOL        = 5     Director: pool size for weighted random pick
```

### DB schema (current — relevant tables)

```sql
games (id, title, curation, steam_appid, playtime_minutes,
       tagging_status, tracklist_source, yt_playlist_id, needs_review, created_at, updated_at)
-- yt_playlist_id: Phase 1 cache — YouTube OST playlist ID (NULL until discovered or seeded)
-- Seeded on startup from data/yt-playlists.json; set at runtime by fetchGameCandidates

tracks (game_id, name, position, active, energy, role, moods,
        instrumentation, has_vocals, tagged_at)
-- PK: (game_id, name)
-- active: INTEGER NOT NULL DEFAULT 1 (1 = curation-eligible, 0 = excluded until Backstage activation)
-- role: TEXT — stores JSON array of TrackRole values (e.g. '["combat","cinematic"]'). Up to 2 values.
--        Parsed by toTrack() via parseJsonArray. Tagger writes JSON.stringify(roles).
-- Notes: clean track names from source (Discogs, manual, etc); all metadata is nullable until tagged

video_tracks (video_id, game_id, track_name, duration_seconds, aligned_at)
-- PK: (video_id, game_id)
-- FK: (game_id, track_name) → tracks(game_id, name)
-- duration_seconds: INTEGER, populated by ensureDurations on first generation; NULL until fetched
-- track_name: NULL = unaligned (junk or legacy); populated by resolver
```

---

## 2. Design Principles

1. **Universal Schema = Source of Truth.** The `tracks` table holds all track metadata regardless of origin. No source-specific columns (`mb_release_id`, `mb_recording_id` removed in M1). A generic `tracklist_source TEXT` column on `games` records where the tracklist was imported from (e.g. `"discogs"`, `"manual"`, `"vgmdb"`). The app never couples to any external data source. The source is game-level (not per-track) because curator edits and re-ingests the entire tracklist as a unit.

2. **70/30 Heuristic Split.** The automated LLM tagger gets roughly 70% of tags right on the first pass. A `needs_review INTEGER DEFAULT 0` flag on `games` marks games where the curator should review or correct the tracklist (e.g., tracks in the wrong language, source mismatch). The Backstage admin page (M4) surfaces these for manual correction. Game-level flag enables curator to request reimport by changing `tracklist_source`.

3. **Power Law of Video Game Music.** The top 200–500 games (Final Fantasy, Zelda, Skyrim, Halo, Persona, etc.) will drive 90% of user queries. The head is manually verified and perfected via Backstage. The tail (thousands of obscure indie titles) runs on automated accuracy — if an energy tag is slightly off for an obscure game, the stakes are very low.

4. **Source-Agnostic Ingestion.** Discogs is the primary ingestion tool today (built-in `genre: Stage & Screen` + `style: Video Game Music` filtering). The architecture allows adding VGMdb, MusicBrainz, or manual entry later — each writes to the same `tracks` table with a different `source` value.

5. **Onboarding = Ingestion Time.** Track data is fetched when a game is added (not in a bulk script). This keeps the experience responsive: add a game, its tracks appear in the background.

6. **Backstage = Manual Override Layer.** An admin page for reviewing tracks, editing names, correcting tags, and triggering re-tagging. Filtered by `needs_review`. This is the critical piece that makes the 70/30 split viable at scale.

7. **DB Tracklist = Identity, YouTube = Audio Source.** A track in the `tracks` table (e.g. "Mantis Lords") is the entity that owns metadata. A YouTube video is a pointer to playable audio for that track (via `video_tracks`). When Discogs and YouTube disagree on the tracklist, the DB wins. YouTube videos that don't match any DB track are auto-discovered as disabled candidates for curator review — never silently injected into the active pool.

8. **Quality over Coverage.** A game without a Discogs tracklist participates in generation at reduced quality — default tags, YouTube-title identity — not as a silent equal. The pipeline never hides this degradation from the user. Curation quality is the goal; the legacy path is a known, surfaced compromise.

---

## 3. Target Architecture

The system transitions from an LLM-as-assembler to a classical Recommendation System with strict separation of concerns:

- **LLM** → only generates metadata (tagging), performs fuzzy matching (track resolution), and session profiling (rubric). Never makes structural decisions.
- **Deterministic code** → all scoring, constraint enforcement, and playlist assembly.
- **Music Identity** is decoupled from **Audio Source**: a track in the `tracks` table (e.g. "Mantis Lords") is the entity that owns metadata; a YouTube video ID is just a pointer to it via `video_tracks`. See Design Principle 7.

### Data flow

```
GAME ONBOARDING (eager, on game-add, fires in M3)
  ├─ Discogs API → tracklist (pristine names, track order)
  │                 stored in `tracks` table, games.tracklist_source = 'discogs:12345'
  ├─ LLM Tagger → tags stored on `tracks` rows
  │                energy · role · moods · instrumentation · has_vocals · tagged_at
  │                games.needs_review = 1 if LLM detects low confidence
  └─ games.tagging_status = 'ready'

  Fallback: no Discogs match → tagging_status = 'limited'
            (legacy YouTube-title path at generation time; surfaced to user in UI)

BACKSTAGE (manual, admin page at /backstage, UI added in M4)
  ├─ View game tracklist + tags + tracklist_source
  ├─ Edit track names, correct tags
  ├─ Filter by needs_review = 1 (curator finds problematic games)
  ├─ Edit games.tracklist_source → triggering re-ingest (change source, retry Discogs)
  ├─ Trigger re-tagging for a game (clear tags, re-LLM)
  └─ Add/remove/edit tracks manually

CURATION PIPELINE (on Generate)
  Phase 1:   YouTube playlist discovery (cached in games.yt_playlist_id)
  Phase 1.5: Track Resolution (TODO M7)
               Only runs when active tracks exist without video_ids.
               Two-step hybrid:
               a) Playlist mapping — fetch OST playlist, LLM aligns video titles → DB track names
               b) Per-track fallback — for active DB tracks still unmatched,
                  search YouTube individually (targeted, not full playlist)
               Auto-discovery (side effect of step a):
                  Unmatched playlist videos → disabled tracks with video_id already set
                  + game.needs_review = true
                  Next run: existing disabled rows already have video_ids → noop
               Cached in video_tracks
  Phase 2:   Vibe Profiler (M9 ✅, LLM, optional)
               session history + mood hint → ScoringRubric
  Phase 3:   Heuristic Director (deterministic)
               arc template + rubric → weighted scoring → weighted-random top-N
               Candidate pool filtered to active tracks only
```

### Legacy fallback (no Discogs match)

When Discogs finds no soundtrack for a game, `tagging_status` is set to `'limited'`. During generation, `fetchGameCandidates` checks `Tracks.hasData(gameId)`. If false, it falls through to the existing YouTube-based stub path (default tags). The `limited` status is surfaced to the user in the GenerateSection as "X games have limited soundtrack data." The legacy path should be upgraded to produce `moods`, `instrumentation`, and `hasVocals` in a future milestone.

---

## 4. Milestones

### Dependencies

```
M0 ✅ → M1 ✅ → M2 ✅ → M3 ✅ → M4
                 M3 → M5 ✅
                 M1 → M6 ✅ → M7 ✅ → M8 ✅ → M9
```

Execute in order: **M0 ✅, M1 ✅, M2 ✅, M3 ✅, M5 ✅, M6 ✅, M7 ✅, M8 ✅, M9 ✅, M4 (parallel)**

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
    energy: number; roles: string; moods: string; instrumentation: string; hasVocals: boolean;
    // roles: JSON.stringify(TrackRole[]) — stored in tracks.role column as JSON array
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

## M2 — LLM Tagger ✅ DONE

**What was built**

A new tagger (`src/lib/pipeline/tagger.ts`) that operates on pristine track names from the `tracks` table.

**Implementation**

```typescript
export async function tagTracks(
  gameId: string,
  gameTitle: string,
  tracks: Track[],
  provider: LLMProvider,
): Promise<void>;
```

- **Input**: clean names from `tracks` table via `Tracks.getByGame()`
- **Output**: energy (1/2/3), role, moods (1–3), instrumentation (1–3), hasVocals, needsReview
- **Caching**: skips rows where `tagged_at IS NOT NULL`
- **Batching**: splits tracks into `TAG_BATCH_SIZE` (25) batches, capped at `TAG_POOL_MAX` (80) per game
- **Validation**: energy + role required; moods/instrumentation soft-filtered to valid enum values, sliced to 3; `hasVocals` defaults false, `confident` defaults true
- **Error handling**: LLM failures, unparseable JSON, or low-confidence items set `games.needs_review = true`
- **Persistence**: via `Tracks.updateTags` with moods/instrumentation as JSON strings

**LLM prompt** (temperature 0.2, maxTokens 4096):

- **System**: instructs LLM to return JSON array with index, energy, role, moods, instrumentation, hasVocals, confident. Lists all valid enum values inline.
- **User**: `Game: <title>\n\nTracks:\n1. <name>\n2. <name>\n...`
- **JSON extraction**: `raw.match(/\[[\s\S]*\]/)` handles markdown fences (same pattern as vibe-check.ts)

**Verification** ✅ Passed

```bash
npm run build && npm run lint  # zero errors
# Can be tested in isolation by calling tagTracks with real LLM provider
```

---

### M3 — Game Onboarding Pipeline ✅ DONE

Fire-and-forget indexer triggered when a game is added. Drives `tagging_status` through `pending → indexing → ready/failed`. Fully implemented and building clean.

**What was built**

- `src/lib/pipeline/onboarding.ts` — orchestrator: sets `indexing`, calls Discogs, upserts tracks, calls tagger, sets `tracklist_source`, sets `ready`. No-Discogs-data path flags `needs_review` and sets `ready`. Any throw sets `failed`.
- `src/lib/db/repos/games.ts` — added `Games.setStatus()`, `bulkImportSteam` returns `importedIds`.
- `src/lib/db/schema.ts` — `active INTEGER NOT NULL DEFAULT 1` on tracks; `game_review_flags` table (see below).
- `src/lib/db/mappers.ts` — `active: row.active !== 0` in `toTrack()`.
- `src/types/index.ts` — `active: boolean` on `Track`; `ReviewReason` enum.
- `src/lib/db/repos/review-flags.ts` — new `ReviewFlags` repo with `markAsNeedsReview(gameId, reason, detail?)` and `listByGame(gameId)`.
- `src/lib/db/repo.ts` — exports `review-flags`.
- `src/app/api/games/route.ts` — POST captures `user`, fires `void onboardGame(game, user.tier)`.
- `src/app/api/steam/import/route.ts` — sequential onboarding loop over `result.importedIds`.

**Review flag system**

Games accumulate rows in `game_review_flags` — one row per detected problem, so a game may have multiple reasons. `ReviewFlags.markAsNeedsReview()` atomically inserts a flag row and sets `games.needs_review = 1`.

| `ReviewReason`     | Trigger                                                                  |
| ------------------ | ------------------------------------------------------------------------ |
| `llm_call_failed`  | LLM request threw; detail = `"batch N: <error>"`                         |
| `llm_parse_failed` | Response wasn't valid JSON; detail = `"batch N: <error>"`                |
| `low_confidence`   | LLM returned `confident: false`; detail = track name                     |
| `empty_metadata`   | LLM returned invalid energy or unrecognized role; detail = field + value |
| `no_discogs_data`  | Discogs search returned null for the game                                |

**Inspect flags**

```bash
sqlite3 bgmancer.db "SELECT g.title, f.reason, f.detail, f.created_at FROM game_review_flags f JOIN games g ON g.id = f.game_id ORDER BY f.created_at DESC"
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

### M5 — Game Status UI ✅ DONE

**What was built**

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

### M6 — Track Resolution ✅ DONE

**What was built**

A hybrid pipeline step that resolves DB tracks to YouTube videos. Replaces the old "Audio Alignment" concept with a directional flow: start from DB tracks, find videos for them. Auto-discovers new tracks from YouTube as a side effect.

**`src/lib/pipeline/resolver.ts`** (new file)

```typescript
export async function resolveTracksToVideos(
  game: Game,
  tracks: Track[], // active DB tracks needing video IDs
  provider: LLMProvider,
): Promise<ResolvedTrack[]>;
```

**Flow:**

1. **Check if resolution is needed** — filter active tracks to those without a video_id (no `video_tracks` row). If all active tracks already have video_ids, return early — no playlist fetch, no discovery, no cost.

2. **Playlist mapping** (bulk, cheap) — find the YouTube OST playlist (from `game.yt_playlist_id` or search). Fetch all playlist items. Use LLM to align video titles → DB track names (same "answer key" prompt as old aligner concept). Result: some DB tracks get a video, some don't, some playlist videos don't match any DB track.

3. **Auto-discovery** (always-on, side effect of step 2) — for playlist videos that matched no DB track:
   - Only runs because step 1 already required fetching the playlist. If all active tracks have video_ids, the playlist is never fetched and discovery never fires.
   - Check if a disabled track with that name already exists → skip (idempotent)
   - Otherwise: insert into `tracks` with `active = 0` **and its video_id already set** (from the playlist item), append to end of position sequence
   - Set `game.needs_review = true` (new potential songs found)
   - Do NOT tag these tracks (untagged + disabled until curator reviews in Backstage)
   - When a curator activates a discovered track, it already has a video_id — no re-discovery triggered.

4. **Per-track fallback** (targeted, expensive) — for active DB tracks that still have no video after playlist mapping:
   - Search YouTube for `"<game title> <track name> OST"` individually
   - Pick the best match (duration filter, channel heuristics)
   - Insert into `video_tracks`
   - This only runs for the gap — most tracks are covered by step 2

5. **Persist** — upsert all new alignments to `video_tracks`.

**YouTube quota note**: Step 2 costs 1 search + N list calls. Step 4 costs 1 search per unmatched track (100 quota units each). For well-known games where the playlist matches most tracks, step 4 fires for 0–3 tracks. The hybrid approach keeps quota reasonable.

**`src/lib/db/repos/video-tracks.ts`** (new file)

```typescript
export const VideoTracks = {
  getByVideoIds(videoIds: string[], gameId: string): Map<string, string | null>
  getByGame(gameId: string): Map<string, string | null>  // all video→track mappings for a game
  upsertBatch(rows: Array<{ videoId: string; gameId: string; trackName: string | null }>): void
}
```

**Key files**

| File                               | Action                          |
| ---------------------------------- | ------------------------------- |
| `src/lib/pipeline/resolver.ts`     | Create                          |
| `src/lib/db/repos/video-tracks.ts` | Create                          |
| `src/lib/db/repo.ts`               | Modify — add VideoTracks export |

**How to verify**

```bash
# After running resolution on a game with track data:
sqlite3 bgmancer.db "SELECT video_id, track_name FROM video_tracks WHERE game_id = '<id>' LIMIT 10"
# Expect: real track names for music videos, NULL for junk

# Check auto-discovered tracks:
sqlite3 bgmancer.db "SELECT name, active FROM tracks WHERE game_id = '<id>' AND active = 0"
# Expect: tracks from YouTube playlist not in Discogs tracklist, with active = 0

# Second run on same game (all active tracks have video_ids) = no playlist fetch, no LLM calls
```

---

### M7 — Pipeline Integration

**What to build**

Wire tracks + audio alignment into `fetchGameCandidates`. Delete old Vibe Check / Casting. The `TaggedTrack` type is the unified output — only the source of its metadata changes.

**`src/lib/pipeline/candidates.ts`** — update `fetchGameCandidates`

```
if Tracks.hasData(gameId):
  activeTracks = Tracks.getByGame(gameId).filter(t => t.active)  // only active tracks
  Phase 1: YouTube discovery (unchanged)
  Phase 1.5: resolveTracksToVideos(game, activeTracks, provider)
             → auto-discovers unmatched playlist videos as disabled tracks (side effect)
             → filter out null-aligned videos
  Build TaggedTrack[] by joining:
    - YouTube metadata (videoId, title, channelTitle, thumbnail)
    - tracks row matched by resolution
      cleanName = ResolvedTrack.trackName (the DB canonical name — never raw YouTube title)
      energy, role, moods, instrumentation, hasVocals from tracks table
  Return { kind: 'tagged', game, tracks: TaggedTrack[] }
else:
  legacy stub: default tags, cleanName = YouTube title
  tagging_status = 'limited' is the signal that this game is curated at reduced quality
  these games are NOT silently equal — M7 should emit a distinct pipeline progress event
  labelling them as "legacy path — limited quality"
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

1. Generate a playlist for a game with track data → track names are pristine DB canonical names (no YouTube noise).
2. Junk videos absent from playlist.
3. Generate for a game without track data → still works via legacy stub; pipeline progress event labels it "limited quality".
4. `npm run build && npm run lint` pass.

---

### M8 — Enhanced Director Scoring ✅ DONE

**What was built**

Replaced the additive placeholder scorer with a Weighted Jaccard Resonance model. Arc template extended with full emotional profiles per phase. Multi-role support added across the full stack.

**Scoring model** (`src/lib/pipeline/director.ts`)

- `ArcSlot` extended: `preferredMoods`, `penalizedMoods`, `preferredInstrumentation` added to all 6 phases
- `scoreTrack(track, slot, rubric?)` rewritten with Weighted Jaccard:
  - Energy gate: `-Infinity` if not in `slot.energyPrefs`
  - Role: binary intersection — `track.roles ∩ slot.rolePrefs ≠ ∅` → 1.0, else 0.0. Weight: 0.40
  - Mood: `jaccard(track.moods, targetMoods)`. Weight: 0.35
  - Instrumentation: `jaccard(track.instrumentation, targetInst)`. Weight: 0.25
  - Penalty: 0.5× multiplier if any penalized mood present (arc + rubric unioned)
  - Vocals penalty: 0.5× if `rubric.allowVocals === false && track.hasVocals`
- `pickBestTrack` → `weightedTopN()`: sort by score, take top 5, weighted random draw (`P ∝ score + 0.01`)
- `assemblePlaylist(taggedPools, games, targetCount, rubric?)` — rubric is optional, Director falls back to arc slot defaults when absent

**Multi-role refactor**

`role: TrackRole` → `roles: TrackRole[]` across the full stack:

| File                             | Change                                                                                  |
| -------------------------------- | --------------------------------------------------------------------------------------- |
| `src/types/index.ts`             | `Track.roles`, `TaggedTrack.roles`, `ResolvedTrack.roles`                               |
| `src/lib/db/mappers.ts`          | `toTrack` uses `parseJsonArray` on `tracks.role` column                                 |
| `src/lib/db/repos/tracks.ts`     | `updateTags` payload: `roles: string` (JSON array)                                      |
| `src/lib/pipeline/tagger.ts`     | Prompt asks for `roles` array (1–2 values); parses and writes `JSON.stringify(roles)`   |
| `src/lib/pipeline/resolver.ts`   | `toResolvedTrack` passes `roles`; discovered stub uses `roles: []`                      |
| `src/lib/pipeline/candidates.ts` | Filter: `roles.length > 0`; map: `roles: r.roles`; legacy: `roles: [TrackRole.Ambient]` |
| `src/lib/pipeline/director.ts`   | `scoreTrack` checks `track.roles.some(r => slot.rolePrefs.includes(r))`                 |

**Other additions**

- `ScoringRubric` interface in `src/types/index.ts`
- Scoring weight constants in `src/lib/constants.ts` (`SCORE_WEIGHT_ROLE`, `SCORE_WEIGHT_MOOD`, `SCORE_WEIGHT_INSTRUMENT`, `SCORE_PENALTY_MULTIPLIER`, `SCORE_VOCALS_PENALTY_MULTIPLIER`, `DIRECTOR_TOP_N_POOL`)
- `DIRECTOR.md` — full architectural deep dive: arc visualization, Weighted Jaccard math spec, rubric interaction model, worked example ($R = 0.917$ for "The Last of Us Main Theme" in outro slot), edge cases, performance ($O(T \cdot S)$, <50ms)

**Verification** ✅ Passed

```bash
npm run build && npm run lint  # zero errors
```

---

### M9 — Vibe Profiler (LLM Rubric Generator) ✅ DONE

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

1. **Generation never hard-fails due to onboarding state.** If `tagging_status = 'limited'` (no Discogs data) or `'failed'` (onboarding threw), the legacy YouTube-title path is used. If onboarding is mid-flight (`'indexing'`), the UI prevents generation, but the pipeline itself is still safe. `'limited'` and `'failed'` are distinct: `'limited'` is a data quality signal surfaced to the user; `'failed'` is an infrastructure error.
2. **`TaggedTrack` is the unified representation.** The source of its data (`tracks` table or legacy stub) is an internal detail. The Director always receives the same type.
3. **All DB writes are idempotent.** `upsertBatch` everywhere. `CREATE TABLE IF NOT EXISTS`. Re-running onboarding on an already-ready game is a no-op.
4. **LLM calls are always cached.** `tracks.tagged_at` caches tagging. `video_tracks` caches alignment. `games.yt_playlist_id` caches playlist discovery. No LLM call happens twice for the same input.
5. **`npm run build` and `npm run lint` pass after each milestone** with zero errors.
6. **The `tracks` table is source-agnostic.** All game-level metadata (`tracklist_source`, `needs_review`) lives on `games` row. Tracks are pure metadata (name, position, active, energy, role, moods, instrumentation, hasVocals, taggedAt).
7. **Auto-discovered tracks start disabled.** Tracks created by the resolver's auto-discovery path are always `active = 0` and untagged. They never enter the curation pipeline until a curator activates them in the Backstage. This prevents YouTube noise (fan remixes, trailers, wrong game) from polluting playlists.

---

## 6. Things to Delete

**Already removed** (done in the Quality Shift milestone prior to M7):

- `allow_full_ost` column from `games` table — full-OST compilation path eliminated
- `game_yt_playlists` table — replaced by `games.yt_playlist_id` column (1:1 relationship made a separate table unnecessary)
- `src/lib/db/repos/yt-playlists.ts` + `YtPlaylists` repo export — replaced by `Games.setPlaylistId()`
- `src/app/api/yt-cache/route.ts` — user playlist override API removed
- `YtPlaylists.upsertForUser` / `clearForUser` methods — user override methods removed

**As part of M7**, the following should be removed cleanly:

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

| File                                | Milestone | Purpose                                                |
| ----------------------------------- | --------- | ------------------------------------------------------ |
| `src/lib/services/discogs.ts`       | M1        | Discogs API client                                     |
| `src/lib/db/repos/tracks.ts`        | M1        | DB repo for tracks table                               |
| `src/lib/pipeline/tagger.ts`        | M2        | LLM tagger for clean track names                       |
| `src/lib/pipeline/onboarding.ts`    | M3        | Game indexing orchestrator                             |
| `src/app/backstage/**`              | M4        | Backstage pages (see BACKSTAGE_DESIGN.md)              |
| `src/app/api/backstage/**`          | M4        | Backstage API routes (see BACKSTAGE_DESIGN.md)         |
| `src/components/backstage/**`       | M4        | Backstage UI components                                |
| `src/lib/pipeline/resolver.ts`      | M6        | YouTube → DB track resolution (hybrid)                 |
| `src/lib/db/repos/video-tracks.ts`  | M6        | DB repo for video_tracks                               |
| `src/lib/pipeline/vibe-profiler.ts` | M9        | LLM Vibe Profiler → ScoringRubric                      |
| `DIRECTOR.md`                       | M8        | Architectural deep dive: scoring model, arc, math spec |

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

---

## 9. QA — Branch `refactor/curation-hueristic-pipleine`

This section is a handoff for a QA agent. The branch covers two subsystems: **Game Onboarding** (M0–M3, M5) and **Heuristic Pipeline** (M6–M9 + post-M9 refactors). The QA agent should produce a concrete plan — specific files to read, behaviours to exercise, and design questions to answer — then execute it.

### Pre-flight

```bash
npm run db:reset   # required — video_tracks now has duration_seconds column
npm run build      # must pass clean
npm run lint       # must pass clean
```

---

### Part 1: Game Onboarding (M0–M3, M5)

**Functional — exercise these flows:**

- Add a game that exists on Discogs → verify `tagging_status` transitions `pending → indexing → ready`, tracks appear in DB with energy/mood/instrumentation set, `tracklist_source` is populated
- Add a game with no Discogs match → `tagging_status = ready`, `needs_review = true`, a `no_discogs_data` review flag row exists in `game_review_flags`
- Add a game and kill Ollama mid-tagging → `tagging_status = failed`, appropriate review flag written
- Steam import → each imported game is onboarded sequentially; verify status progression in UI
- Game status UI (M5): add a game and watch the status badge update via polling; verify failed badge shows on failure

**Design / architecture review:**

- `src/lib/pipeline/onboarding.ts` — is the status state machine correct? Are all exit paths (success, no-Discogs, throw) handled? Does a retry path exist or is failed terminal?
- `src/lib/db/repos/review-flags.ts` — does `markAsNeedsReview` correctly accumulate multiple reasons for the same game (not overwrite)?
- `src/lib/services/discogs.ts` — is rate-limit handling robust? Is best-result selection logic (format preference + community.have) defensible?
- `src/lib/pipeline/tagger.ts` — are the validation rules consistent with the enums in `src/types/index.ts`? Is the batch/pool cap logic correct (`TAG_BATCH_SIZE=25`, `TAG_POOL_MAX=80`)?
- `src/app/api/games/route.ts` and `src/app/api/steam/import/route.ts` — is onboarding correctly fire-and-forget (non-blocking)? Does a Steam import onboard sequentially or in parallel, and is that the right call?

---

### Part 2: Heuristic Pipeline (M6–M9 + refactors)

**Functional — exercise these flows:**

- **Bard tier**: generate → no "Generating vibe profile…" event; playlist produces with arc defaults
- **Maestro tier**: generate → "Generating vibe profile…" event visible; temporarily log the rubric in `profileVibe` to verify it reflects the games' aesthetics (e.g. Dark Souls → dark/orchestral, Stardew → peaceful/acoustic)
- **Maestro with LLM unavailable**: unset `ANTHROPIC_API_KEY` or stop Ollama → generation completes without rubric, no crash
- **Duration storage**: first generation for a game populates `video_tracks.duration_seconds`; second generation produces no YouTube duration API calls in server logs
- **Short track filter**: enable filter, generate → confirm tracks under 90s are absent; check they were excluded before the Director (not after)
- **Long track filter**: same as above for tracks over 8 min
- **Legacy game** (no rows in `tracks` table): progress event reads "Legacy path — limited quality"; tracks appear with stub tags (energy 2, role Ambient)
- **Curated game**: progress event reads "X tracks resolved"; tracks carry real tags from `tracks` table
- **No playlist found**: game with unmatchable title → fallback pending track in playlist; rest of generation unaffected

**Design / architecture review:**

- `src/lib/pipeline/index.ts` — is `generatePlaylist` a pure orchestrator with no inline logic? Do the five step functions (`gatherCandidates`, `filterByDuration`, `profileVibe`, `runDirector`, `persistSession`) have clean, single responsibilities?
- `src/lib/pipeline/candidates.ts` — is `ensureDurations` the right abstraction? Is it correct that both curated and legacy paths share it? Does `resolveCurated` vs `resolveLegacy` split make the branching logic clear?
- `src/lib/pipeline/vibe-profiler.ts` — is the validation logic consistent with enums? Is the null-return-on-degraded-rubric threshold (`preferredMoods` empty) the right call?
- `src/lib/pipeline/director.ts` — review the Weighted Jaccard Resonance implementation: are weights (role 0.40, mood 0.35, instrumentation 0.25) applied correctly? Is the rubric override (XOR, not merge) behaving as described? Is top-N weighted random correct?
- `src/lib/db/repos/video-tracks.ts` — `storeDurations` uses an upsert that inserts new rows for legacy tracks and updates existing NULL durations. Verify the `WHERE duration_seconds IS NULL` guard in the conflict clause is correct SQL and won't silently skip rows.
- **Type integrity**: `TaggedTrack.durationSeconds` is `number` (not `| null`) — trace the full path from `ensureDurations` through `resolveCurated`/`resolveLegacy` to `filterByDuration` to confirm no null can slip through. The `?? 0` fallback in candidates is the last line of defence — is 0 the right sentinel or should it be handled differently?
- **Code conventions**: all named value sets are enums (not string literal unions); no "cache" terminology; comments in pipeline files are accurate and not stale (the refactor removed Vibe Check — verify no dead references remain)
