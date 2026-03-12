# BGMancer Heuristic Pipeline — Work Document

This document is the single source of truth for rebuilding the BGMancer playlist generation pipeline into a full Recommendation System architecture. A new agent can read this document and begin implementation immediately without any additional context.

---

## 1. Current State (Baseline)

### What exists today

The generation pipeline (`src/lib/pipeline/index.ts`) has three phases plus an optional Vibe Check step:

**Phase 1** — YouTube OST playlist discovery per game. Searches YouTube for the game's official OST playlist, stores the playlist ID in `game_yt_playlists` (cached). Then fetches all video items from that playlist.

**Phase 2** — LLM tagger (`tagger.ts`). Takes the raw YouTube video titles and asks the LLM to produce, per track:

- `cleanName` — the track name stripped of YouTube noise (e.g. "Hollow Knight OST - 12 - Mantis Lords [Extended]" → "Mantis Lords")
- `energy` — integer 1 (calm) / 2 (moderate) / 3 (intense)
- `role` — one of: opener, ambient, build, combat, closer, menu, cinematic
- `isJunk` — true for 10-hour loops, sound effects, duplicate variants, non-music

Results cached in `track_tags` by `(video_id, game_id)`. Only uncached tracks are sent to the LLM.

**Vibe Check (optional, Maestro tier only)** — `casting.ts` builds a candidate pool of ~2.5× target count tracks, weighted by game curation mode. `vibe-check.ts` sends this pool to the LLM with the session context (moodHint — currently hardcoded `null` — and recently played track names). The LLM scores each track 1–100 as `fitScore`, returning a `Map<videoId, VibeScore>`. On parse failure or Bard tier, returns an empty map and the Director falls back to tag-only scoring.

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

- The tagger takes **noisy YouTube titles** as input and must guess the clean name — unreliable, especially for non-English games.
- **Junk filtering** depends on the LLM recognising junk purely from a messy title with no external reference — it misses many 10-hour loops and compilation videos.
- The tagger runs **lazily during generation** — every first-time generate is slow and blocks the user.
- `TaggedTrack` carries no mood or instrumentation data — when there is no Vibe Check (Bard tier, or Vibe Check failure), scoring is `energy match + 5 role bonus` only. Very low signal.
- The Vibe Check is Maestro-only and produces opaque `fitScore` integers that cannot be inspected or tuned without changing the LLM prompt.
- `moodHint` is hardcoded `null` — the Vibe Check always runs in "no specific mood" mode, reducing its usefulness.
- No visual indication in the UI that a game's tracks have been indexed and are ready to use.

### Files to understand before starting

| File                             | Role                                                                     |
| -------------------------------- | ------------------------------------------------------------------------ |
| `src/lib/pipeline/index.ts`      | Entry point — orchestrates all phases + Vibe Check                       |
| `src/lib/pipeline/candidates.ts` | Phases 1+2: YouTube discovery + tagging                                  |
| `src/lib/pipeline/tagger.ts`     | LLM tagger (YouTube titles → cleanName/energy/role/isJunk)               |
| `src/lib/pipeline/director.ts`   | Phase 3: arc assembly, `assemblePlaylist`, `scoreTrack`, `pickBestTrack` |
| `src/lib/pipeline/vibe-check.ts` | LLM session scorer → `Map<videoId, VibeScore>` (to be replaced)          |
| `src/lib/pipeline/casting.ts`    | Builds vibe check candidate pool at ~2.5× target (to be deleted)         |
| `src/lib/db/schema.ts`           | All table definitions                                                    |
| `src/lib/db/repos/track-tags.ts` | DB read/write for `track_tags`                                           |
| `src/app/api/games/route.ts`     | CRUD for game library                                                    |
| `src/types/index.ts`             | All shared types incl. `TaggedTrack`, `VibeScore`                        |
| `src/lib/constants.ts`           | All tuning constants                                                     |
| `src/lib/llm/index.ts`           | Provider resolution (Bard → Ollama, Maestro → Anthropic)                 |

### Key types (current)

```typescript
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
  // NO moods, instrumentation, hasVocals
}

interface VibeScore {
  fitScore: number; // 1–100, primary scoring signal in Director
}
```

### Key constants (current)

```
TAG_BATCH_SIZE          = 25    LLM tagging batch size
TAG_POOL_MAX            = 80    Max tracks per game sent to tagger
CASTING_POOL_MULTIPLIER = 2.5   Vibe Check candidate pool multiplier
VIBE_RECENTLY_PLAYED_LIMIT      Max recent track names passed to Vibe Check
```

### DB schema (current — relevant tables)

```sql
games (id, title, allow_full_ost, curation, steam_appid, playtime_minutes, created_at, updated_at)

track_tags (video_id, game_id, clean_name, energy, role, is_junk, tagged_at)
-- PK: (video_id, game_id)
-- NO moods, instrumentation, has_vocals columns

game_yt_playlists (game_id, user_id, playlist_id, discovered_at)
-- PK: (game_id, user_id)
```

---

## 2. Target Architecture

The system transitions from an LLM-as-assembler to a classical Recommendation System with strict separation of concerns:

- **LLM** → only generates metadata and performs fuzzy matching. Never makes structural decisions.
- **Deterministic code** → all scoring, constraint enforcement, and playlist assembly.
- **Music Identity** is decoupled from **Audio Source**: a canonical track (e.g. "Mantis Lords") is the entity that owns metadata; a YouTube video ID is just a pointer to it.

### New data flow

```
GAME ONBOARDING (eager, on game add)
  └─ MusicBrainz API → canonical tracklist (pristine names, track order, MB IDs)
  └─ LLM Canonical Tagger → tags stored on canonical_tracks rows
       energy · role · moods · instrumentation · has_vocals
  └─ games.tagging_status = 'ready'

CURATION PIPELINE (on Generate)
  Phase 1:   YouTube playlist discovery (unchanged, cached)
  Phase 1.5: Audio Alignment (LLM)
               YouTube raw titles → canonical track names (or null = junk)
               canonical name = display name (no further cleaning)
               cached in track_alignment
  Phase 2:   Rubric Generator (deterministic, no LLM)
               load last session's track tags
               frequency-analyze moods · instruments · energy · roles
               → ScoringRubric | null
  Phase 3:   Heuristic Director
               for each arc slot: filter → score (weighted additive) → weighted-random top-5
               rubric used for scoring; arc template's implicit moods used as fallback
```

### Legacy fallback (no MusicBrainz match)

When MusicBrainz finds no soundtrack for a game, `tagging_status` is set to `'ready'` anyway (no data means no canonical path available). During generation, `fetchGameCandidates` checks `hasCanonicalData(gameId)`. If false, it falls through to the existing YouTube-based tagger path. The legacy path should also be upgraded to produce `moods`, `instrumentation`, and `hasVocals` (M6).

---

## 3. Milestones

### Dependencies

```
M0 → M1 → M2 → M3 → M4 → M5 → M6
M0 → M7  (independent of canonical path)
M6 + M7 → M8
```

Execute in order: **M0, M1, M2, M3, M4, M5, M6, M7, M8**

---

### M0 — Schema Foundation ✅ DONE

**What was built**

All new DB tables and types. Several design decisions were made during implementation that deviate from the original spec — those are the authoritative decisions going forward.

**Design decisions made**

1. **`track_tags` eliminated entirely.** The original plan kept `track_tags` as a legacy fallback for games with no MusicBrainz data. Since there are no production users, we consolidated to a single track metadata table (`tracks`). All games use the same path — `mb_recording_id = NULL` simply indicates a non-MB-sourced entry. This removes the dual code path entirely.

2. **No migration system.** No `ALTER TABLE`. All schema changes go directly in `CREATE TABLE` definitions in `schema.ts` and are applied with `npm run db:reset`. Documented in `CLAUDE.md`.

3. **Naming cleaned up.** `canonical_tracks` → `tracks`. `track_alignment` → `video_tracks`. `canonical_name` column → `track_name`. `CanonicalTrack` type → `Track`. Removes the redundant "canonical" qualifier since there is only one track metadata table.

4. **`mb_release_id` moved to `games`.** It is a property of the game's MusicBrainz release, not of individual tracks. `tracks` retains only `mb_recording_id` (which is per-track).

5. **FK constraint on `video_tracks.track_name`.** `FOREIGN KEY (game_id, track_name) REFERENCES tracks(game_id, name)` enforces that every alignment row points to a real track row. `NULL` track_name is still allowed (signals junk).

6. **All named value sets are enums.** `TrackMood`, `TrackInstrumentation`, `TrackRole`, `TaggingStatus` are all TypeScript enums (not literal union types), consistent with `CurationMode` and `UserTier`. Documented in `CLAUDE.md`.

7. **Legacy tagger deleted.** `src/lib/pipeline/tagger.ts` (YouTube-title-based tagger) and `src/lib/db/repos/track-tags.ts` are gone. `fetchGameCandidates` has a stub that passes YouTube tracks through with default tags (`TODO M2`) so generation remains functional. The reroll route is simplified to a random pick until M6 rebuilds it against the new repos.

**Actual schema (final)**

```sql
games          -- added: tagging_status, mb_release_id
tracks         -- new: (game_id, name) PK, mb_recording_id, energy, role, moods, instrumentation, has_vocals, tagged_at
video_tracks   -- new: (video_id, game_id) PK, track_name (FK → tracks), aligned_at
```

**Types added / changed (`src/types/index.ts`)**

```typescript
enum TaggingStatus { Pending, Indexing, Ready, Failed }
enum TrackMood     { Epic, Tense, Peaceful, ... }        // 15 values
enum TrackInstrumentation { Orchestral, Synth, ... }     // 15 values
enum TrackRole     { Opener, Ambient, Build, ... }       // was a literal type, now enum

interface Game     { ...existing + tagging_status, mb_release_id }
interface Track    { gameId, name, position, mbRecordingId, energy, role, moods, instrumentation, hasVocals, taggedAt }
interface TaggedTrack { ...existing + moods, instrumentation, hasVocals }
```

**Ready for M1 because**

- `tracks` table exists and is ready to receive MusicBrainz data.
- `video_tracks` table exists and is ready to receive alignment data.
- `games.tagging_status` exists and is ready to be driven through its lifecycle.
- `games.mb_release_id` exists and is ready to be written by the MusicBrainz service.
- `TaggedTrack` already carries `moods`, `instrumentation`, `hasVocals` — the Director will use them as soon as M2 populates them.
- `npm run build` and `npm run lint` pass.

---

### M1 — MusicBrainz Service

**What to build**

A standalone HTTP client for the MusicBrainz API. No pipeline wiring yet — just the service + repo.

**`src/lib/services/musicbrainz.ts`** (new file)

```typescript
// Three-call flow to find a game OST:
// 1. GET /ws/2/release-group?query="<title>" AND secondarytype:soundtrack&fmt=json
//    → pick best match by score, prefer official status
// 2. GET /ws/2/release?release-group=<RGID>&fmt=json
//    → pick best release (prefer digital, worldwide, official)
// 3. GET /ws/2/release/<REID>?inc=recordings&fmt=json
//    → return recordings as CanonicalTrack[]

export async function searchGameSoundtrack(gameTitle: string): Promise<CanonicalTrack[] | null>;
```

Rate limiting: enforce 1 req/sec (MusicBrainz Terms of Service). Use a simple module-level timestamp + sleep approach. User-Agent header: `BGMancer/1.0 (contact@bgmancer.app)` (required by MB TOS).

**`src/lib/db/repos/canonical-tracks.ts`** (new file)

```typescript
export const CanonicalTracks = {
  getByGame(gameId: string): CanonicalTrack[]
  upsertBatch(tracks: CanonicalTrack[]): void
  hasCanonicalData(gameId: string): boolean     // COUNT > 0
  isTagged(gameId: string): boolean              // COUNT WHERE tagged_at IS NOT NULL > 0
}
```

**Expected behavior after M1**

Calling `searchGameSoundtrack("Hollow Knight")` returns an array like:

```
[{ name: "Dirtmouth", position: 1, mbRecordingId: "...", ... }, ...]
```

Returns `null` for games with no MB soundtrack entry (e.g. very obscure indie titles).

**How to verify**

Write a quick test script (can be a throwaway `scripts/test-mb.ts`):

```typescript
import { searchGameSoundtrack } from "@/lib/services/musicbrainz";
const tracks = await searchGameSoundtrack("Hollow Knight");
console.log(tracks?.length, tracks?.[0]);
```

Run with `npx tsx scripts/test-mb.ts`.
Expect ~70-100 tracks for Hollow Knight, first track named "Dirtmouth" or similar.
Test with a known-missing title (e.g. a made-up game) — expect `null`.

---

### M2 — Canonical LLM Tagger

**What to build**

A new tagger that operates on pristine canonical track names rather than noisy YouTube titles. Tags are stored directly on `canonical_tracks` rows. Key differences from the current `tagger.ts`:

- **Input**: canonical names (pristine, e.g. "Mantis Lords") — no cleaning needed
- **Output**: energy, role, moods (1–3), instrumentation (1–3), hasVocals — **no** `cleanName`, **no** `isJunk`
- Tags are stored on `canonical_tracks`, not `track_tags`
- Uses same batch + cache pattern (check `tagged_at`, skip already-tagged rows)

**`src/lib/pipeline/canonical-tagger.ts`** (new file)

```typescript
// System prompt differs from tagger.ts:
// - No cleanName field
// - No isJunk field
// - Adds moods (1-3 from vocabulary), instrumentation (1-3 from vocabulary), hasVocals

export async function tagCanonicalTracks(
  gameId: string,
  gameTitle: string,
  tracks: CanonicalTrack[],
  provider: LLMProvider,
): Promise<void>;
// Persists energy, role, moods, instrumentation, hasVocals to canonical_tracks via CanonicalTracks.upsertBatch
```

The LLM prompt should look like:

```
You are a Video Game Music metadata tagger. Given a game title and its official track names,
return structured metadata for each track.

Output ONLY a valid JSON array. Each element:
{ "index": <1-based>, "energy": <1|2|3>, "role": "<role>", "moods": [...], "instrumentation": [...], "hasVocals": <boolean> }

Fields:
- energy: 1=calm/ambient, 2=moderate/exploration, 3=intense/combat/boss
- role: one of "opener", "ambient", "build", "combat", "closer", "menu", "cinematic"
- moods: 1-3 from: epic, tense, peaceful, melancholic, triumphant, mysterious, playful, dark,
         ethereal, heroic, nostalgic, ominous, serene, chaotic, whimsical
- instrumentation: 1-3 from: orchestral, synth, acoustic, chiptune, piano, rock, metal,
                   electronic, choir, ambient, jazz, folk, strings, brass, percussion
- hasVocals: true if the track has singing/vocals
```

**Expected behavior after M2**

Calling `tagCanonicalTracks("game-id", "Hollow Knight", canonicalTracks, provider)` populates all `canonical_tracks` rows for that game with energy, role, moods, instrumentation, hasVocals. Calling it again on the same game is a no-op (skips already-tagged rows).

**How to verify**

After running the function on a game that has canonical tracks:

```bash
sqlite3 bgmancer.db "SELECT name, energy, role, moods, instrumentation, has_vocals FROM canonical_tracks WHERE game_id = '<id>' LIMIT 5"
```

Expect: `moods` = a JSON array like `["peaceful","mysterious"]`, `instrumentation` populated, `energy` 1/2/3.
Re-run → same results (cache works, no duplicate LLM calls).

---

### M3 — Game Onboarding Pipeline

**What to build**

The fire-and-forget indexer triggered when a game is added. Drives `tagging_status` through its lifecycle. Never throws — errors are caught, status set to `'failed'`.

**`src/lib/pipeline/onboarding.ts`** (new file)

```typescript
export async function onboardGame(game: Game, tier: UserTier): Promise<void> {
  // 1. Set status → 'indexing'
  // 2. searchGameSoundtrack(game.title)
  // 3a. If found:
  //     - CanonicalTracks.upsertBatch(tracks)
  //     - tagCanonicalTracks(game.id, game.title, tracks, provider)
  //     - Games.setStatus(game.id, 'ready')
  // 3b. If not found:
  //     - Games.setStatus(game.id, 'ready')  ← legacy path at generation time
  //     - log: "[onboard] No MB data for <title>, falling back to legacy tagger"
  // On any throw:
  //     - Games.setStatus(game.id, 'failed')
  //     - console.error(...)
}
```

**`src/lib/db/repos/games.ts`** (or wherever `Games` repo lives)

Add: `Games.setStatus(gameId: string, status: TaggingStatus): void`

**`src/app/api/games/route.ts`** — update POST handler

```typescript
const user = Users.getOrCreate(userId);
const game = Games.create(userId, id, body.title.trim(), CurationMode.Include, steamAppid);
void onboardGame(game, user.tier); // fire-and-forget
return NextResponse.json(game, { status: 201 });
```

**`src/app/api/steam/import/route.ts`** — trigger `onboardGame` for each new game, but sequentially with a short delay between calls to respect MB rate limiting.

**Expected behavior after M3**

1. User adds "Hollow Knight" → response returns immediately with `tagging_status: 'pending'` (or `'indexing'` if the status is set before the response).
2. In the background: status flips to `'indexing'`, MB is queried, tracks are stored and tagged, status flips to `'ready'`.
3. If MB fails or times out: status = `'failed'`, game is still usable via legacy path.
4. Adding a game that already exists in the DB (duplicate check) should not re-trigger onboarding.

**How to verify**

```bash
# Start dev server, add a game via the Library UI or curl:
curl -X POST http://localhost:6959/api/games \
  -H 'Content-Type: application/json' \
  -d '{"title": "Hollow Knight"}'

# Poll the game status:
watch -n 2 'sqlite3 bgmancer.db "SELECT title, tagging_status FROM games"'
# Should see: pending → indexing → ready (within ~10-30s depending on MB + LLM speed)

# Confirm canonical tracks were created:
sqlite3 bgmancer.db "SELECT COUNT(*) FROM canonical_tracks WHERE game_id = '<id>'"
# Should be ~70-100 for Hollow Knight

# Confirm tags were applied:
sqlite3 bgmancer.db "SELECT name, energy, role, moods FROM canonical_tracks WHERE game_id = '<id>' LIMIT 5"
```

---

### M4 — Game Status UI

**What to build**

Visual per-game readiness indicator in the Library. The Generate button becomes context-aware.

**`src/app/library/library-client.tsx`**

Add a status badge next to each game in the list:

- `'pending'` or `'indexing'` → small spinner + grey text "Indexing…"
- `'ready'` → no badge (clean default, silence = success)
- `'failed'` → warning icon + red/amber text "Index failed" with a tooltip explaining the legacy fallback is still active

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

**`src/app/feed-client.tsx`**

Pass the readiness info through to `GenerateSection`. The `gameLibrary.games` array already flows through context, so check `games.filter(g => g.curation !== 'skip').some(g => g.tagging_status === 'indexing')`.

**Expected behavior after M4**

1. Add a game → spinner appears immediately in Library next to the game name.
2. Generate button shows "1 game is still being indexed…" and is disabled.
3. After ~15-30s, spinner disappears, Generate button re-enables.
4. A game that failed to index shows a warning badge but does not prevent generation.

**How to verify**

1. Open the Library page.
2. Add a new game.
3. Observe the spinner next to the game.
4. Navigate to the main feed — confirm Generate is disabled with the indexing message.
5. Wait for indexing to complete — confirm spinner gone, Generate re-enabled.
6. Optionally: force a failure by temporarily breaking the MB service or using a nonsense title — confirm warning badge appears and Generate still works.

---

### M5 — Audio Alignment

**What to build**

A new pipeline step that maps raw YouTube video titles to canonical track names. Replaces name-cleaning entirely. `null` alignment = junk. Results cached in `track_alignment`.

**`src/lib/pipeline/aligner.ts`** (new file)

```typescript
export async function alignVideosToCanonical(
  videos: OSTTrack[],
  canonicalTracks: CanonicalTrack[],
  gameTitle: string,
  provider: LLMProvider,
): Promise<Map<string, string | null>>;
// Returns: Map<videoId, canonicalName | null>
// null = junk (10-hour loops, interviews, duplicate variants, non-music)
```

LLM prompt structure: provide the canonical tracklist as the "answer key" — the model's task is to match each raw YouTube title to the closest canonical entry or `null`. This is fundamentally easier than open-ended name cleaning because the model has the correct answer set.

Cache-first pattern:

1. Check `track_alignment` for all video IDs
2. Only call LLM for uncached videos
3. Upsert results to `track_alignment`

**`src/lib/db/repos/track-alignment.ts`** (new file)

```typescript
export const TrackAlignment = {
  getByVideoIds(videoIds: string[], gameId: string): Map<string, string | null>
  upsertBatch(rows: Array<{ videoId: string; gameId: string; canonicalName: string | null }>): void
}
```

**Expected behavior after M5**

Given a YouTube playlist for "Hollow Knight" with titles like:

- `"Hollow Knight OST - 03 - Dirtmouth"` → `"Dirtmouth"`
- `"Hollow Knight - Full Soundtrack (1 hour)"` → `null` (junk)
- `"Team Cherry - Dev Commentary"` → `null` (junk)

The alignment map contains correct canonical names for genuine tracks, and `null` for junk. All results are cached — second call on same video IDs does not hit the LLM.

**How to verify**

```bash
# After generating a playlist that uses a game with canonical data:
sqlite3 bgmancer.db "SELECT video_id, canonical_name FROM track_alignment WHERE game_id = '<id>' LIMIT 10"
# Expect: real track names (matching canonical_tracks.name) for music videos
#         NULL for junk (medleys, loops, non-music)

# Confirm null-aligned videos are absent from the playlist
# (they should never appear in the generated track list)
```

---

### M6 — Pipeline Integration (Canonical Path)

**What to build**

Wire canonical tracks + audio alignment into `fetchGameCandidates`. The `TaggedTrack` type is the unified output — only the source of its metadata changes.

**`src/lib/pipeline/candidates.ts`** — update `fetchGameCandidates`

```
if CanonicalTracks.hasCanonicalData(gameId):
  Phase 1: YouTube discovery (unchanged)
  Phase 1.5: alignVideosToCanonical(ytTracks, canonicalTracks, gameTitle, provider)
             → filter out null-aligned videos
  Build TaggedTrack[] by joining:
    - YouTube metadata (videoId, title, channelTitle, thumbnail)
    - canonical_tracks row matched by alignment (cleanName, energy, role, moods, instrumentation, hasVocals)
  Return { kind: 'tagged', game, tracks: TaggedTrack[] }
else:
  existing legacy flow (unchanged)
```

**`src/lib/pipeline/tagger.ts`** — extend legacy tagger

The legacy path (no MB data) should also produce richer tags. Extend the existing LLM prompt and `TagResult` interface to include `moods`, `instrumentation`, `hasVocals`. Extend `TrackTags.upsertBatch` and `rowToTag` to handle the new columns.

**`src/lib/db/repos/track-tags.ts`** — extend for new columns

Update `rowToTag` to parse `moods` and `instrumentation` JSON columns. Update `upsertBatch` to write them. Update `getByVideoIds` / `getByGame` SELECT queries to include new columns.

**Files to delete** (no longer needed after M6)

- `src/lib/pipeline/vibe-check.ts`
- `src/lib/pipeline/casting.ts`

Remove their imports from `src/lib/pipeline/index.ts`. Remove `VibeScore` type from `src/types/index.ts`. Remove `getVibeCheckProvider` from `src/lib/llm/index.ts`.

**Expected behavior after M6**

1. Generate a playlist for a game with canonical data → playlist track names are pristine canonical names (no YouTube noise like "OST - 03 -" or "[Extended]").
2. 10-hour loops, interviews, and duplicate videos are absent from the playlist.
3. Generate for a legacy game (no MB data) → still works, tracks now also have moods/instrumentation populated in `track_tags`.
4. `npm run build` and `npm run lint` pass with zero errors.

**How to verify**

1. Add "Hollow Knight" (has MB data) and "Some Obscure Game" (no MB data) to library.
2. Generate playlist.
3. Inspect track names: Hollow Knight tracks should look like "Dirtmouth", "Forgotten Crossroads" — not YouTube-style titles.
4. Inspect the DB:

   ```bash
   sqlite3 bgmancer.db "SELECT track_name, video_title FROM playlist_tracks LIMIT 10"
   # track_name should be the canonical name; video_title is the raw YouTube title
   ```

5. Confirm `vibe-check.ts` and `casting.ts` are deleted and the build still passes.

---

### M7 — Enhanced Director Scoring

**What to build**

Upgrade `scoreTrack` from a trivial placeholder to a full weighted additive scorer. The arc template gains per-phase emotional profiles used as a fallback rubric when no session rubric is available.

**`src/lib/constants.ts`** — add scoring weight constants

```typescript
// ─── Director scoring weights ─────────────────────────────────────────────────
export const SCORE_BASELINE = 50;
export const SCORE_ROLE_MATCH = 10; // track.role matches slot.rolePrefs
export const SCORE_MOOD_MATCH = 8; // per mood in preferredMoods (up to 3 = max +24)
export const SCORE_MOOD_PENALTY = 12; // per mood in penalizedMoods
export const SCORE_INSTRUMENT_MATCH = 5; // per instrument in preferredInstrumentation (up to 2 = max +10)
export const SCORE_VOCALS_PENALTY = 15; // when rubric.allowVocals = false and track.hasVocals = true
export const DIRECTOR_TOP_N_POOL = 5; // top-N candidates for weighted random selection
```

**`src/lib/pipeline/director.ts`** — extend `ArcSlot` and rewrite `scoreTrack`

Extend `ArcSlot`:

```typescript
interface ArcSlot {
  phase: string;
  energyPrefs: Array<1 | 2 | 3>;
  rolePrefs: TrackRole[];
  preferredMoods: TrackMood[];
  penalizedMoods: TrackMood[];
  preferredInstrumentation: TrackInstrumentation[];
}
```

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
if track.energy not in slot.energyPrefs → return -Infinity   // hard filter

// Role
if track.role in slot.rolePrefs → score += SCORE_ROLE_MATCH
if rubric?.preferredRoles includes track.role → score += SCORE_ROLE_MATCH  // stacks

// Mood scoring — use rubric if provided, else arc slot's implicit moods
activeMoods    = rubric?.preferredMoods  ?? slot.preferredMoods
penalizedMoods = rubric?.penalizedMoods  ?? slot.penalizedMoods
for each mood in track.moods:
  if mood in activeMoods    → score += SCORE_MOOD_MATCH
  if mood in penalizedMoods → score -= SCORE_MOOD_PENALTY

// Instrumentation
activeInstruments = rubric?.preferredInstrumentation ?? slot.preferredInstrumentation
for each inst in track.instrumentation:
  if inst in activeInstruments → score += SCORE_INSTRUMENT_MATCH

// Vocals
if rubric?.allowVocals === false and track.hasVocals → score -= SCORE_VOCALS_PENALTY
```

Also update `assemblePlaylist` signature:

```typescript
export function assemblePlaylist(
  taggedPools: Map<string, TaggedTrack[]>,
  games: Game[],
  targetCount: number,
  rubric?: ScoringRubric, // was: vibeScores?: Map<string, VibeScore>
): TaggedTrack[];
```

Pass `rubric` through to `scoreTrack` and `pickBestTrack`.

Replace the current weighted-random logic in `pickBestTrack` with a proper top-N weighted random:

```typescript
scored.sort((a, b) => b.score - a.score);
const topN = scored.slice(0, DIRECTOR_TOP_N_POOL);
const minScore = topN[topN.length - 1].score;
const weights = topN.map((c) => c.score - minScore + 1);
const totalWeight = weights.reduce((s, w) => s + w, 0);
let rand = Math.random() * totalWeight;
for (let i = 0; i < topN.length; i++) {
  rand -= weights[i];
  if (rand <= 0) return topN[i].track;
}
return topN[topN.length - 1].track;
```

**Expected behavior after M7**

- Intro tracks are consistently calm and atmospheric (peaceful/mysterious moods, piano/ambient instruments).
- Peak/climax tracks are consistently intense (epic/heroic moods, orchestral/rock instruments).
- Generating the same library twice produces **different** playlists (weighted random ensures variety).
- Generating with a library that has full rich tags (moods + instruments populated) produces noticeably better arc coherence than the same library with empty tags (old behavior).

**How to verify**

1. Generate a 50-track playlist. Export the track list.
2. Generate again with the same games. Confirm the playlist is different (weighted random).
3. Inspect track names in order: intro tracks should feel calm, tracks 30-40 should feel intense, last few should feel conclusive.
4. Check scores in debug logs: add a temporary `console.log` to `scoreTrack` to confirm score distribution (intro slot tracks should score 50-70, peak tracks 50-90 depending on moods).

---

### M8 — Vibe Profiler (LLM Rubric Generator)

**What to build**

Phase 2 of curation. An LLM call that takes session context as input and produces a structured `ScoringRubric` as output. The rubric is then handed to the Director for Phase 3 scoring. On LLM failure or insufficient context the rubric is `null` — the Director falls back gracefully to arc-implicit scoring.

This replaces `vibe-check.ts`, which produced opaque per-track `fitScore` integers. The Vibe Profiler instead produces a single structured rubric that the fully deterministic Director can apply transparently.

**How it works**

The Vibe Profiler operates in two steps:

1. **Deterministic pre-processing** (no LLM): load the user's most recent session's tags from the DB, compute a plain-language summary of dominant patterns (e.g. "mostly peaceful + melancholic moods, orchestral + piano instrumentation, low energy, no vocals"). This pre-processing caps the context to a manageable size and makes the LLM prompt consistent.

2. **LLM interpretation**: send the summary + optional `moodHint` + list of games being used to the LLM. Ask it to produce a structured `ScoringRubric` JSON.

The LLM is not picking tracks. It is only answering: _"Given this listening context, what kind of music should this session favor?"_

**`src/types/index.ts`** — add `ScoringRubric`

```typescript
export interface ScoringRubric {
  targetEnergy: Array<1 | 2 | 3>;
  preferredMoods: TrackMood[];
  penalizedMoods: TrackMood[];
  preferredInstrumentation: TrackInstrumentation[];
  penalizedInstrumentation: TrackInstrumentation[];
  allowVocals: boolean | null; // null = no preference
  preferredRoles: TrackRole[];
}
```

**`src/lib/db/repos/track-tags.ts`** — add `getForRecentSession`

```typescript
getForRecentSession(userId: string, limit: number): TaggedTrack[]
// Fetches tags for tracks from the user's most recently COMPLETED session
// (OFFSET 1 — not the session being replaced by the current generation).
// SQL:
// SELECT tt.* FROM track_tags tt
// JOIN playlist_tracks pt ON pt.video_id = tt.video_id AND pt.game_id = tt.game_id
// JOIN playlists p ON p.id = pt.playlist_id
// WHERE p.user_id = ?
//   AND p.id = (SELECT id FROM playlists WHERE user_id = ?
//               ORDER BY created_at DESC LIMIT 1 OFFSET 1)
//   AND tt.is_junk = 0
// LIMIT ?
```

**`src/lib/constants.ts`** — add constants

```typescript
export const RUBRIC_HISTORY_LIMIT = 50; // max recent tracks passed to Vibe Profiler
```

**`src/lib/llm/index.ts`** — add provider

```typescript
/**
 * Vibe Profiler provider — generates the ScoringRubric for Phase 2.
 * Uses the tagging provider for both tiers (available to Bard via Ollama).
 * Override model independently via ANTHROPIC_VIBE_PROFILER_MODEL.
 */
export function getVibeProfilerProvider(tier: UserTier): LLMProvider {
  return providerForTier(tier, "ANTHROPIC_VIBE_PROFILER_MODEL");
}
```

**`src/lib/pipeline/vibe-profiler.ts`** (new file)

```typescript
interface VibeContext {
  recentTracks: TaggedTrack[]; // from previous session
  moodHint: string | null; // optional user text ("Late night focus", etc.)
  gameTitles: string[]; // names of games being used in this generation
}

export async function generateRubric(
  ctx: VibeContext,
  provider: LLMProvider,
): Promise<ScoringRubric | null>;
```

**System prompt** (abbreviated):

```
You are a music playlist curator. Given listening context, output a JSON ScoringRubric
that guides which game OST tracks to favor in this session.

Output ONLY a valid JSON object. Schema:
{
  "targetEnergy": [<1|2|3>, ...],         // 1=calm, 2=moderate, 3=intense
  "preferredMoods": ["<mood>", ...],       // up to 3
  "penalizedMoods": ["<mood>", ...],       // up to 3
  "preferredInstrumentation": ["<type>", ...],  // up to 3
  "penalizedInstrumentation": ["<type>", ...],  // up to 2
  "allowVocals": true | false | null,      // null = no preference
  "preferredRoles": ["<role>", ...]        // up to 3
}

Valid moods: epic, tense, peaceful, melancholic, triumphant, mysterious, playful,
             dark, ethereal, heroic, nostalgic, ominous, serene, chaotic, whimsical
Valid instrumentation: orchestral, synth, acoustic, chiptune, piano, rock, metal,
                       electronic, choir, ambient, jazz, folk, strings, brass, percussion
Valid roles: opener, ambient, build, combat, closer, menu, cinematic
```

**User prompt** construction:

- If `moodHint` present: `Session vibe requested by user: "<hint>"`
- If `recentTracks` present (after deterministic summary): `Recent listening profile: mostly [top moods], [top instruments], energy tends toward [mode energy].`
- Always: `Games in this session: [list of titles]`
- If no context at all: request a balanced, varied rubric

On any parse failure → return `null`. Do not throw.

**`src/lib/pipeline/index.ts`** — wire Phase 2

```typescript
// Between tagging (Phase 1+2) and assembly (Phase 3):
const recentTracks = TrackTags.getForRecentSession(userId, RUBRIC_HISTORY_LIMIT);
const vibeProvider = getVibeProfilerProvider(user.tier);
const rubric = await generateRubric(
  { recentTracks, moodHint: null, gameTitles: activeGames.map((g) => g.title) },
  vibeProvider,
);
// null = LLM failed or no context — Director uses arc-implicit scoring fallback

const orderedTracks = assemblePlaylist(
  taggedPools,
  activeGames,
  assembleTarget,
  rubric ?? undefined,
);
```

`moodHint` is wired as `null` for now. Adding user-facing input for it is a future UI task.

Also update the doc comment at the top of `index.ts` to accurately describe the new architecture (remove all references to VibeCheck, casting, VibeScore).

**Expected behavior after M8**

1. **First generation (no history)**: `recentTracks` is empty → context-light prompt → LLM returns a balanced general rubric or null. Playlist shaped primarily by arc template.
2. **Second generation (has history)**: LLM receives the listening profile summary from the previous session and produces a rubric reflecting that context. If the previous session was heavy on peaceful/orchestral, the new rubric should prefer those.
3. **Rubric is interpretable**: it's a structured object you can log and read, unlike the old opaque per-track `fitScore`.
4. **Failure is safe**: if the LLM returns malformed JSON or times out, `generateRubric` returns null and generation continues without a rubric.

**How to verify**

1. Generate a first playlist. Note the dominant mood/instrument character.
2. Generate again. Add a temporary log to `index.ts`:

   ```typescript
   console.log("[pipeline] Rubric:", JSON.stringify(rubric, null, 2));
   ```

3. Confirm the rubric's `preferredMoods` and `preferredInstrumentation` reflect what you heard in the first playlist.
4. The second playlist should feel similar in vibe to the first while selecting different tracks (weighted random in the Director ensures variety).
5. Verify null fallback: temporarily break the LLM call (throw in `generateRubric`) — generation should still complete successfully, shaped by arc-implicit scoring only.

---

## 4. Invariants — What Must Always Be True

Across all milestones, these guarantees must hold:

1. **Generation never hard-fails due to onboarding state.** If `tagging_status = 'failed'`, the legacy path is used. If canonical tagging is mid-flight (`'indexing'`), the UI prevents generation, but the pipeline itself is still safe.
2. **`TaggedTrack` is the unified representation.** The source of its data (canonical_tracks or track_tags) is an internal detail. The Director always receives the same type.
3. **All DB writes are idempotent.** `upsertBatch` everywhere. `CREATE TABLE IF NOT EXISTS`. `ALTER TABLE` in try/catch. Re-running onboarding on an already-ready game is a no-op.
4. **LLM calls are always cached.** `track_tags` caches by `(video_id, game_id)`. `canonical_tracks` caches by `(game_id, name)` with `tagged_at`. `track_alignment` caches by `(video_id, game_id)`. `game_yt_playlists` caches playlist discovery. No LLM call happens twice for the same input.
5. **`npm run build` and `npm run lint` pass after each milestone** with zero errors.

---

## 5. Things to Delete

As part of M6, the following should be removed cleanly:

| File                             | Reason                         |
| -------------------------------- | ------------------------------ |
| `src/lib/pipeline/vibe-check.ts` | Replaced by Vibe Profiler (M8) |
| `src/lib/pipeline/casting.ts`    | Was only used by vibe-check    |

Also remove:

- `VibeScore` interface from `src/types/index.ts`
- `getVibeCheckProvider` from `src/lib/llm/index.ts`
- `VIBE_RECENTLY_PLAYED_LIMIT` constant from `src/lib/constants.ts` (replaced by `RUBRIC_HISTORY_LIMIT`)
- All imports of the above in `src/lib/pipeline/index.ts`

---

## 6. Quick Reference — New Files

| File                                   | Milestone | Purpose                            |
| -------------------------------------- | --------- | ---------------------------------- |
| `src/lib/services/musicbrainz.ts`      | M1        | MusicBrainz API client             |
| `src/lib/db/repos/canonical-tracks.ts` | M1        | DB repo for canonical_tracks       |
| `src/lib/pipeline/canonical-tagger.ts` | M2        | LLM tagger for canonical names     |
| `src/lib/pipeline/onboarding.ts`       | M3        | Game indexing orchestrator         |
| `src/lib/pipeline/aligner.ts`          | M5        | YouTube → canonical name alignment |
| `src/lib/db/repos/track-alignment.ts`  | M5        | DB repo for track_alignment        |
| `src/lib/pipeline/vibe-profiler.ts`    | M8        | LLM Vibe Profiler → ScoringRubric  |

---

## 7. Dev Server

```bash
npm run dev          # starts on port 6959 with Turbopack
npm run build        # must pass after every milestone
npm run lint         # ESLint — must pass after every milestone
npm run db:reset     # drops and recreates DB (run after M0 schema changes)
npm run db:backup    # snapshot current DB
npm run db:restore   # restore from snapshot
```

SQLite DB file: `bgmancer.db` at project root. Connect with `sqlite3 bgmancer.db` for inspection.
