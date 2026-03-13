# BGMancer Backstage — Feature Design

The Backstage is the admin control plane for BGMancer's track metadata. It is the manual override layer that makes the 70/30 automated/manual split viable at scale — without it, there is no way to inspect, correct, or improve what the LLM tagger produces.

**The user-facing app is clean and simple. The Backstage is dense, informative, and powerful.**

---

## 1. Design Philosophy

### Visibility over Magic

The Backstage exists because automation is not 100% accurate. Its job is to make the state of the data visible, the problems obvious, and the fixes fast.

### Progressive Disclosure

The default view is a high-density overview table. Detail editing happens in a **slide-over drawer** that opens from the right edge when a track row is clicked. This prevents the main table from being cluttered with edit controls while keeping the editing surface one click away.

### Density & Precision

- **Monospace font** (system `ui-monospace` / JetBrains Mono) for IDs, tag arrays, and source values. Makes spotting anomalies (wrong energy, missing moods) significantly easier in a dense table.
- **Color-coded tags**: energy levels get colored badges (1=blue/calm, 2=amber/moderate, 3=red/intense). Mood and instrumentation tags are neutral-colored chips. `needs_review` rows get an amber left-border highlight.
- **No pagination by default** for game tracklists — most games have 20-80 tracks, which fits in a single scrollable view. The game list itself is paginated.

### Real-time Feedback

Long-running operations (re-tagging, ingestion) use **Server-Sent Events (SSE)** to stream progress updates to the Backstage UI. Same pattern as the existing playlist generation SSE in `POST /api/playlist/generate`.

When a re-tag or ingestion is running:

- A progress bar appears inline: _"Tagging track 42/100…"_
- The affected rows update live as each batch completes
- The operation is cancellable (abort the SSE connection)

---

## 2. Information Architecture

The Backstage has two levels: the **Game Index** (overview of all games) and the **Game Detail** (deep dive into one game's tracks).

### Level 1 — Game Index (`/backstage`)

A dense table of all games in the library with aggregate metadata:

| Column  | Content                                                                           |
| ------- | --------------------------------------------------------------------------------- |
| Title   | Game name                                                                         |
| Status  | `tagging_status` badge (pending/indexing/ready/failed)                            |
| Tracks  | Total track count                                                                 |
| Tagged  | Count of tracks with `tagged_at IS NOT NULL`                                      |
| Review  | Count of tracks with `needs_review = 1` (amber if > 0)                            |
| Source  | Ingestion source (e.g. "discogs", "manual") — derived from first track's `source` |
| Actions | Re-ingest, Re-tag, Delete tracks                                                  |

**Sorting**: default sort by Review count descending (worst first — games that need the most attention float to the top).

**Filtering**:

- Search by game title (instant, client-side)
- Status filter: all / pending / indexing / ready / failed
- "Needs review" toggle: only show games with `review > 0`

**Summary bar** at the top (the Health Dashboard):

```
Total Games: 142 | With Tracks: 128 | Needs Review: 34 tracks across 12 games | Failed: 2 games
```

Clicking a game row navigates to the Game Detail view.

### Level 2 — Game Detail (`/backstage/[gameId]`)

Two sections: a **game header** and a **track table**.

#### Game Header

- Game title (large)
- Status badge
- Source info
- Track stats: total / tagged / needs_review
- Action buttons: **Re-tag All**, **Re-ingest**, **Add Track** (manual), **Mark All Reviewed**

#### Track Table

High-density table with the following columns:

| Column          | Type                        | Editable                     |
| --------------- | --------------------------- | ---------------------------- |
| #               | Position number             | No                           |
| Name            | Track name                  | Yes (inline)                 |
| Energy          | 1 / 2 / 3 badge             | Yes (dropdown in drawer)     |
| Role            | Role tag                    | Yes (dropdown in drawer)     |
| Moods           | Tag chips (up to 3)         | Yes (multi-select in drawer) |
| Instrumentation | Tag chips (up to 3)         | Yes (multi-select in drawer) |
| Vocals          | Yes/No icon                 | Yes (toggle in drawer)       |
| Review          | Amber dot if `needs_review` | Yes (toggle)                 |

**Inline editing**: Track name is editable directly in the table (click to edit, Enter to save, Escape to cancel).

**Drawer editing**: Clicking anywhere else on a row opens the **Track Detail Drawer** from the right edge. The drawer contains:

- Full editing controls for all tag fields (dropdowns, multi-selects, toggles)
- A "Save" button that persists changes and closes the drawer
- A "Discard" button that reverts
- The raw `source` and `tagged_at` timestamp

**Row highlighting**:

- `needs_review = 1` → amber left border + subtle amber background
- `tagged_at IS NULL` (untagged) → grey text, dimmed row

**Bulk selection**: Checkbox column on the left. When rows are selected, a floating action bar appears at the bottom:

- "Set Energy to…" (dropdown)
- "Set Role to…" (dropdown)
- "Add Mood…" / "Remove Mood…"
- "Mark Reviewed" / "Mark Needs Review"
- "Delete Selected"

**Filter bar** above the table:

- Search by track name
- Energy filter (1/2/3/all)
- "Needs review only" toggle
- "Untagged only" toggle

---

## 3. Core Operations

### A. Data Explorer (Observability)

| Feature           | Detail                                                                                                      |
| ----------------- | ----------------------------------------------------------------------------------------------------------- |
| Health Dashboard  | Summary bar on Game Index: total games, tracked, untracked, needs_review count, failed count                |
| Filterable Tables | Client-side filtering on both Game Index and Track Table — instant, no round-trips                          |
| Validation Flags  | Auto-highlight tracks with conflicting tags: e.g., `role: combat` + `energy: 1` (calm combat is suspicious) |
| Tag Distribution  | Per-game mini-chart or text summary: "Energy: 40% calm / 35% moderate / 25% intense" shown in game header   |

### B. Orchestrator (Flow Triggers)

| Feature       | Detail                                                                                                                                                              |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Re-ingest     | Clears all tracks for a game, re-fetches from Discogs, re-tags. Confirmation modal required (destructive). SSE progress stream.                                     |
| Re-tag        | Clears tag columns (`energy`, `role`, `moods`, `instrumentation`, `has_vocals`, `tagged_at`) but keeps track names and positions. Re-runs LLM tagger. SSE progress. |
| Add Track     | Manual form: enter track name, position. Inserted with `source: 'manual'`, `needs_review: 0`, no tags (untagged until next re-tag or manual edit).                  |
| Delete Tracks | Remove selected tracks from the `tracks` table. Confirmation modal.                                                                                                 |

**Destructive action safety**: All destructive operations (re-ingest, delete) require a confirmation modal with the game title displayed. The modal has a "Type game name to confirm" input for re-ingest (which wipes all existing tracks).

### C. Editor (Manual Intervention)

| Feature          | Detail                                                                                         |
| ---------------- | ---------------------------------------------------------------------------------------------- |
| Inline Name Edit | Click track name → text input. Enter saves, Escape cancels. Debounced API call.                |
| Drawer Tag Edit  | Full editing for energy, role, moods, instrumentation, hasVocals. Dropdowns and multi-selects. |
| Bulk Tag Edit    | Select multiple rows → floating action bar for batch updates.                                  |
| Review Toggle    | Click the amber dot to toggle `needs_review`. Immediate save, no confirmation needed.          |

---

## 4. Security Model

BGMancer is a local-first app with no production users. The Backstage has full write access to the `tracks` table, so a proportionate security approach is needed:

### Current Phase (Local Development)

- **Route**: `/backstage` — simple, discoverable in development
- **No auth gate**: The app uses anonymous sessions with signed JWT cookies. There is no user login system, and adding one just for Backstage is over-engineering at this stage.
- **Destructive confirmation**: Any button that deletes data or triggers an LLM API call has a confirmation modal. Re-ingest requires typing the game name.

### Future Phase (If Deployed)

When/if BGMancer goes multi-user or is deployed publicly, the Backstage should be gated:

- Move to a non-guessable path or subdomain
- Gate access behind a `role: admin` check on the user session
- Add IP whitelisting via Cloudflare or middleware
- Consider MFA for the admin route

This is explicitly **not in scope for M4**. Document it here so it's not forgotten.

---

## 5. Tech Stack

### Shadcn/ui

The Backstage uses **Shadcn/ui** — the current standard for admin/internal tooling. The main app builds its own components (appropriate for a user-facing product), but the Backstage is a control plane where polished data tables, drawers, and dialogs justify the dependency.

Shadcn components are Radix-primitive-backed: keyboard navigation, accessibility, and focus management come for free. For a dense table with slide-over drawers and confirmation modals, this is significant saved effort vs. building from scratch.

**Setup** (`shadcn@latest` supports Tailwind v4):

```bash
npx shadcn@latest init
# Adds: clsx, tailwind-merge, class-variance-authority
# Creates: src/lib/utils.ts (cn() helper), components.json
# Modifies: src/app/globals.css (injects CSS variables)
```

The CSS variables Shadcn adds (`--background`, `--foreground`, `--card`, etc.) are inert to the existing app — all current components use explicit `zinc-*` classes, not CSS variable references. The Backstage routes use Shadcn components exclusively; nothing leaks into the main app.

**Theme**: tune the injected CSS variables to match the existing zinc/violet dark palette:

```css
/* in globals.css, dark block — approximate targets */
--background: zinc-950 (#09090b) --card: zinc-900 (#18181b) --border: zinc-800 (#27272a)
  --primary: violet-600 (#7c3aed) --muted: zinc-800;
```

### Shadcn components to install

| Component  | Use case                                       |
| ---------- | ---------------------------------------------- |
| `Table`    | Game Index + Track Table (core of everything)  |
| `Sheet`    | Slide-over drawer for track editing            |
| `Dialog`   | Confirmation modals (re-ingest, delete)        |
| `Badge`    | Status chips, energy/mood/instrumentation tags |
| `Button`   | Actions throughout                             |
| `Input`    | Search, inline name editing                    |
| `Select`   | Energy/role dropdowns in drawer                |
| `Checkbox` | Row selection for bulk actions                 |
| `Progress` | Re-tag SSE progress bar                        |

Install per-component as needed:

```bash
npx shadcn@latest add table sheet dialog badge button input select checkbox progress
```

### Other stack

- **Next.js App Router** — server component page shells, client components for interactive tables
- **SSE** — same pattern as `POST /api/playlist/generate` for streaming re-tag/re-ingest progress
- **`font-mono`** — Tailwind's monospace stack for tag arrays, IDs, timestamps, source values

### Thin wrapper components

Even with Shadcn, build thin wrappers for BGMancer-specific concerns:

| Wrapper        | Purpose                                                                                             |
| -------------- | --------------------------------------------------------------------------------------------------- |
| `TagBadge`     | Color-coded energy badge (1=sky, 2=amber, 3=rose) + mood/instrumentation chips using Shadcn `Badge` |
| `ConfirmModal` | Wraps Shadcn `Dialog` with optional "type to confirm" input for destructive actions                 |
| `ProgressBar`  | Wraps Shadcn `Progress` with SSE event handling                                                     |
| `FilterBar`    | Composes Shadcn `Input` + `Select` + `Button` into the search/filter strip                          |

---

## 6. API Routes

### `GET /api/backstage/games`

Returns all games with aggregate track metadata:

```typescript
interface BackstageGame {
  id: string;
  title: string;
  tagging_status: TaggingStatus;
  trackCount: number;
  taggedCount: number;
  reviewCount: number;
  source: string | null; // from first track's source column
}
```

### `GET /api/backstage/games/[gameId]/tracks`

Returns all tracks for a game, ordered by position:

```typescript
// Returns: Track[] (full Track interface from types)
```

### `PATCH /api/backstage/tracks`

Update one or more tracks:

```typescript
// Body:
interface TrackPatch {
  gameId: string;
  name: string; // identifies the track (part of PK)
  updates: Partial<{
    name: string; // rename (updates PK — cascades to video_tracks FK)
    energy: number;
    role: string;
    moods: string; // JSON array string
    instrumentation: string; // JSON array string
    hasVocals: boolean;
    needsReview: boolean;
  }>;
}
// Body is: TrackPatch | TrackPatch[] (single or bulk)
```

### `POST /api/backstage/tracks`

Create a manual track:

```typescript
// Body:
{
  gameId: string;
  name: string;
  position: number;
}
// Inserted with source='manual', no tags
```

### `DELETE /api/backstage/tracks`

Delete tracks:

```typescript
// Body:
{ gameId: string; names: string[] }
```

### `POST /api/backstage/retag`

Clear tags and re-run LLM tagger for a game. Returns SSE stream:

```typescript
// Body:
{ gameId: string }

// SSE events:
{ type: "progress", current: number, total: number, trackName: string }
{ type: "done", tagged: number, needsReview: number }
{ type: "error", message: string }
```

### `POST /api/backstage/reingest`

Clear all tracks and re-fetch from Discogs. Returns SSE stream:

```typescript
// Body:
{ gameId: string }

// SSE events:
{ type: "progress", message: string }  // "Searching Discogs…", "Found 45 tracks", "Tagging…"
{ type: "done", trackCount: number, tagged: number, needsReview: number }
{ type: "error", message: string }
```

---

## 7. File Structure

```
src/app/backstage/
  page.tsx                    — server component shell
  backstage-client.tsx        — Game Index client component (Shadcn Table)
  [gameId]/
    page.tsx                  — server component shell (reads gameId param)
    game-detail-client.tsx    — Track Table client component (Shadcn Table + Sheet)

src/app/api/backstage/
  games/
    route.ts                  — GET: list games with aggregates
  games/[gameId]/
    tracks/
      route.ts                — GET: list tracks for game
  tracks/
    route.ts                  — PATCH, POST, DELETE: track CRUD
  retag/
    route.ts                  — POST: re-tag (SSE stream)
  reingest/
    route.ts                  — POST: re-ingest (SSE stream)

src/components/backstage/
  TagBadge.tsx                — color-coded energy/mood badges (wraps Shadcn Badge)
  ConfirmModal.tsx            — destructive confirmation (wraps Shadcn Dialog)
  ProgressBar.tsx             — SSE progress indicator (wraps Shadcn Progress)
  FilterBar.tsx               — search + filter strip (composes Shadcn Input + Select)

src/components/ui/            — Shadcn auto-generated components (added by shadcn add ...)
  table.tsx, sheet.tsx, dialog.tsx, badge.tsx, button.tsx,
  input.tsx, select.tsx, checkbox.tsx, progress.tsx

src/lib/utils.ts              — cn() helper (created by shadcn init)
components.json               — Shadcn config (created by shadcn init)
```

---

## 8. Visual Design Notes

### Color palette (extends existing app dark theme)

- Background: `zinc-950` (page), `zinc-900/60` (table rows), `zinc-800` (drawer)
- Energy badges: `sky-500/20 text-sky-400` (1), `amber-500/20 text-amber-400` (2), `rose-500/20 text-rose-400` (3)
- `needs_review` highlight: `amber-500/10` row background, `amber-500` left border
- Untagged rows: `text-zinc-500` (dimmed)
- Tag chips: `zinc-700 text-zinc-300` (neutral), small rounded pills
- Destructive buttons: `rose-600` background, `rose-500` on hover
- Success/ready badges: `emerald-500/20 text-emerald-400`
- Failed badges: `rose-500/20 text-rose-400`

### Typography

- Game titles and track names: default sans-serif (system font)
- Tag arrays, IDs, timestamps, source values: `font-mono` (monospace)
- Table headers: `text-xs uppercase tracking-wider text-zinc-500`
- Summary bar numbers: `text-lg font-semibold tabular-nums`

### Density targets

- Game Index row height: ~40px (compact)
- Track Table row height: ~36px (very compact, data-dense)
- Drawer width: ~400px (fixed, slides in from right)
- Filter bar height: ~48px

---

## 9. Dependencies on Other Milestones

| Depends on       | Why                                                                                            |
| ---------------- | ---------------------------------------------------------------------------------------------- |
| M1 (Tracks Repo) | `Tracks.getByGame()`, `Tracks.updateTags()`, `Tracks.getNeedingReview()`, `Tracks.clearTags()` |
| M2 (LLM Tagger)  | `tagTracks()` function for the re-tag operation                                                |
| M3 (Onboarding)  | `onboardGame()` for the re-ingest operation, `Games.setStatus()`                               |

The Backstage is M4 in the pipeline plan. It cannot be built before M1-M3 are complete because it depends on the Tracks repo and the tagger.

---

## 10. Out of Scope (Future Enhancements)

These are noted for future consideration but are **not part of M4**:

- **Command Palette (Cmd+K)**: Global search to jump to any game/track. Would be useful once the library grows past ~100 games.
- **Cost Tracker**: Token usage counter for LLM tagging operations. Requires instrumenting the LLM provider layer.
- **Vibe Tester**: Sandbox for testing mood hints against the heuristic scorer. Depends on M8 (Enhanced Director Scoring) and M9 (Vibe Profiler).
- **Audit Log**: Per-track history of who tagged it, when, with which model. Requires a new `track_audit` table.
- **Dry Run / Simulate**: Run LLM alignment without saving to DB. Useful for testing prompt changes.
- **Keyboard navigation**: Arrow keys to move between rows, Enter to open drawer, Escape to close.
