"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Search } from "lucide-react";
import { EnergyBadge } from "@/components/backstage/EnergyBadge";
import { TagBadgeList } from "@/components/backstage/TagBadgeList";
import { TrackEditSheet } from "@/components/backstage/TrackEditSheet";
import type { PatchUpdates } from "@/components/backstage/TrackEditSheet";
import { BulkActionBar } from "@/components/backstage/BulkActionBar";
import { ConfirmModal } from "@/components/backstage/ConfirmModal";
import { QuickViewTabs } from "@/components/backstage/QuickViewTabs";
import type { QuickViewTab } from "@/components/backstage/QuickViewTabs";
import { FilterChipBar } from "@/components/backstage/FilterChipBar";
import type { FilterDef, ActiveFilter } from "@/components/backstage/FilterChipBar";
import type { BackstageTrackRow } from "@/lib/db/repos/tracks";

// ─── Tab presets ────────────────────────────────────────────────────────────

interface TabPreset {
  tab: QuickViewTab;
  params: Record<string, string>;
}

const TAB_PRESETS: TabPreset[] = [
  { tab: { label: "All", value: "all" }, params: {} },
  { tab: { label: "Untagged", value: "untagged" }, params: { untaggedOnly: "1" } },
  { tab: { label: "Active", value: "active" }, params: { active: "1" } },
  { tab: { label: "Inactive", value: "inactive" }, params: { active: "0" } },
];

// ─── Filter definitions ─────────────────────────────────────────────────────

const TRACK_FILTER_DEFS: FilterDef[] = [
  {
    key: "energy",
    label: "Energy",
    options: [
      { label: "Calm", value: "1" },
      { label: "Moderate", value: "2" },
      { label: "Intense", value: "3" },
    ],
  },
  {
    key: "active",
    label: "Active",
    options: [
      { label: "Yes", value: "1" },
      { label: "No", value: "0" },
    ],
  },
  {
    key: "untaggedOnly",
    label: "Untagged Only",
    options: [{ label: "Yes", value: "1" }],
  },
];

// ─── Helpers ────────────────────────────────────────────────────────────────

type TrackKey = `${string}::${string}`;

function trackKey(t: { gameId: string; name: string }): TrackKey {
  return `${t.gameId}::${t.name}`;
}

// ─── Component ──────────────────────────────────────────────────────────────

export function TrackLabClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Search
  const [search, setSearch] = useState(() => searchParams.get("name") ?? "");
  const [gameSearch, setGameSearch] = useState(() => searchParams.get("gameTitle") ?? "");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ?game=<id> comes from Game Hub "View in Track Lab" link — exact game ID match (one-time)
  const initialGameId = searchParams.get("game") ?? undefined;

  // Tabs + filter chips
  const [activeTab, setActiveTab] = useState(() => deriveTabFromParams(searchParams));
  const [activeFilters, setActiveFilters] = useState<ActiveFilter[]>(() =>
    deriveFiltersFromParams(searchParams),
  );

  // Results
  const [tracks, setTracks] = useState<BackstageTrackRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [mutError, setMutError] = useState<string | null>(null);

  // Selection + editing
  const [selected, setSelected] = useState<Set<TrackKey>>(new Set());
  const [editTrack, setEditTrack] = useState<BackstageTrackRow | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);

  // ─── Fetch logic ────────────────────────────────────────────────────────

  const fetchTracks = useCallback(
    async (opts?: {
      overrideGameId?: string;
      search?: string;
      gameSearch?: string;
      tab?: string;
      filters?: ActiveFilter[];
    }) => {
      const s = opts?.search ?? search;
      const gs = opts?.gameSearch ?? gameSearch;
      const t = opts?.tab ?? activeTab;
      const f = opts?.filters ?? activeFilters;
      const overrideGameId = opts?.overrideGameId;

      setLoading(true);
      setSelected(new Set());
      setFetchError(null);

      const apiParams = buildApiParams(s, gs, t, f, overrideGameId);

      // Sync URL (skip the gameId override — that's a one-time Game Hub link)
      if (!overrideGameId) {
        const urlParams = buildUrlParams(s, gs, t, f);
        router.replace(`/backstage/tracks${urlParams.size ? `?${urlParams}` : ""}`, {
          scroll: false,
        });
      }

      try {
        const res = await fetch(`/api/backstage/tracks?${apiParams}`);
        if (!res.ok) throw new Error(`Server error: HTTP ${res.status}`);
        const data = (await res.json()) as BackstageTrackRow[];
        setTracks(data);
        setHasSearched(true);
      } catch (err) {
        console.error("[TrackLabClient] fetchTracks failed:", err);
        setFetchError("Failed to load tracks. Try again.");
        setHasSearched(true);
      } finally {
        setLoading(false);
      }
    },
    [search, gameSearch, activeTab, activeFilters, router],
  );

  // Auto-fetch on mount
  useEffect(() => {
    Promise.resolve().then(() => fetchTracks({ overrideGameId: initialGameId }));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Debounced search ───────────────────────────────────────────────────

  function handleSearchChange(field: "name" | "game", value: string) {
    if (field === "name") setSearch(value);
    else setGameSearch(value);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const opts = field === "name" ? { search: value } : { gameSearch: value };
      fetchTracks(opts);
    }, 300);
  }

  // ─── Tab switching ──────────────────────────────────────────────────────

  function handleTabChange(tab: string) {
    setActiveTab(tab);
    setActiveFilters([]);
    setSelected(new Set());
    fetchTracks({ tab, filters: [] });
  }

  // ─── Filter handlers ────────────────────────────────────────────────────

  function handleFilterChange(key: string, value: string) {
    let next: ActiveFilter[];
    if (value === "") {
      next = activeFilters.filter((f) => f.key !== key);
    } else {
      const existing = activeFilters.find((f) => f.key === key);
      if (existing) {
        next = activeFilters.map((f) => (f.key === key ? { ...f, value } : f));
      } else {
        next = [...activeFilters, { key, value }];
      }
    }
    setActiveFilters(next);
    setActiveTab("all");
    fetchTracks({ tab: "all", filters: next });
  }

  // ─── Derived state ───────────────────────────────────────────────────────

  // Merge tab preset params into active filters so dropdowns reflect the full query state
  const effectiveFilters: ActiveFilter[] = (() => {
    const preset = TAB_PRESETS.find((p) => p.tab.value === activeTab);
    const merged = new Map(activeFilters.map((f) => [f.key, f.value]));
    if (preset) {
      for (const [k, v] of Object.entries(preset.params)) {
        if (!merged.has(k)) merged.set(k, v);
      }
    }
    return [...merged.entries()].map(([key, value]) => ({ key, value }));
  })();

  // ─── Selection helpers ──────────────────────────────────────────────────

  const allSelected = tracks.length > 0 && tracks.every((t) => selected.has(trackKey(t)));

  function toggleAll() {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(tracks.map(trackKey)));
    }
  }

  function toggleOne(t: BackstageTrackRow) {
    const key = trackKey(t);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  // ─── Mutations ──────────────────────────────────────────────────────────

  const patchTracks = useCallback(
    async (patches: { gameId: string; name: string; updates: PatchUpdates }[]) => {
      setMutError(null);
      try {
        const res = await fetch("/api/backstage/tracks", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patches),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        await fetchTracks();
        router.refresh();
      } catch (err) {
        console.error("[TrackLabClient] patchTracks failed:", err);
        setMutError("Failed to save changes. Please try again.");
      }
    },
    [fetchTracks, router],
  );

  function selectedTracks(): BackstageTrackRow[] {
    return tracks.filter((t) => selected.has(trackKey(t)));
  }

  async function bulkSetEnergy(energy: 1 | 2 | 3) {
    const sel = selectedTracks();
    await patchTracks(sel.map((t) => ({ gameId: t.gameId, name: t.name, updates: { energy } })));
  }

  async function bulkSetRole(role: string) {
    const sel = selectedTracks();
    await patchTracks(
      sel.map((t) => ({
        gameId: t.gameId,
        name: t.name,
        updates: { role: JSON.stringify([role]) },
      })),
    );
  }

  async function bulkSetActive(active: boolean) {
    const sel = selectedTracks();
    await patchTracks(sel.map((t) => ({ gameId: t.gameId, name: t.name, updates: { active } })));
  }

  async function bulkMarkReviewed() {
    setMutError(null);
    try {
      const gameIds = [...new Set(selectedTracks().map((t) => t.gameId))];
      for (const gameId of gameIds) {
        const res = await fetch("/api/backstage/review-flags", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ gameId }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
      }
      router.refresh();
    } catch (err) {
      console.error("[TrackLabClient] bulkMarkReviewed failed:", err);
      setMutError("Failed to clear review flags. Please try again.");
    }
  }

  async function bulkDelete() {
    setMutError(null);
    try {
      const sel = selectedTracks();
      const keys = sel.map((t) => ({ gameId: t.gameId, name: t.name }));
      const res = await fetch("/api/backstage/tracks", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keys }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setDeleteModalOpen(false);
      await fetchTracks();
      router.refresh();
    } catch (err) {
      console.error("[TrackLabClient] bulkDelete failed:", err);
      setMutError("Failed to delete tracks. Please try again.");
      setDeleteModalOpen(false);
    }
  }

  async function handleTrackSave(gameId: string, name: string, updates: PatchUpdates) {
    const { videoId, durationSeconds, viewCount, ...trackUpdates } = updates;
    const body: Record<string, unknown> = { gameId, name, updates: trackUpdates };
    if (videoId) {
      body.videoUpdates = { videoId, durationSeconds, viewCount };
    }
    setMutError(null);
    try {
      const res = await fetch("/api/backstage/tracks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await fetchTracks();
    } catch (err) {
      console.error("[TrackLabClient] handleTrackSave failed:", err);
      setMutError("Failed to save track. Please try again.");
    }
  }

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Quick-view tabs */}
      <QuickViewTabs
        tabs={TAB_PRESETS.map((p) => p.tab)}
        active={activeTab}
        onChange={handleTabChange}
      />

      {/* Search + filters */}
      <div className="flex items-center gap-2">
        <div className="relative w-52">
          <Search className="absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
          <Input
            placeholder="Search by track name..."
            value={search}
            onChange={(e) => handleSearchChange("name", e.target.value)}
            className="h-8 border-zinc-700 bg-zinc-900 pl-8 text-xs text-zinc-200 placeholder:text-zinc-600 focus-visible:ring-violet-500/50"
          />
        </div>
        <div className="relative w-44">
          <Search className="absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
          <Input
            placeholder="Filter by game..."
            value={gameSearch}
            onChange={(e) => handleSearchChange("game", e.target.value)}
            className="h-8 border-zinc-700 bg-zinc-900 pl-8 text-xs text-zinc-200 placeholder:text-zinc-600 focus-visible:ring-violet-500/50"
          />
        </div>
        {hasSearched && (
          <span className="ml-auto font-mono text-xs whitespace-nowrap text-zinc-600">
            {tracks.length} result{tracks.length === 1 ? "" : "s"}
          </span>
        )}
      </div>

      {/* Filters */}
      <FilterChipBar
        filters={effectiveFilters}
        definitions={TRACK_FILTER_DEFS}
        onChange={handleFilterChange}
        onReset={() => {
          setActiveFilters([]);
          setActiveTab("all");
          fetchTracks({ tab: "all", filters: [] });
        }}
      />

      {fetchError && <p className="text-xs text-rose-400">{fetchError}</p>}
      {mutError && <p className="text-xs text-rose-400">{mutError}</p>}

      {/* Results */}
      {tracks.length === 0 && hasSearched ? (
        <p className="py-10 text-center text-xs text-zinc-600">
          No tracks match the current filters.
        </p>
      ) : (
        hasSearched && (
          <div
            className={`overflow-hidden rounded-lg border border-zinc-800 transition-opacity ${loading ? "opacity-60" : ""}`}
          >
            <Table>
              <TableHeader>
                <TableRow className="border-zinc-800 hover:bg-transparent">
                  <TableHead className="w-8 px-2">
                    <Checkbox
                      checked={allSelected && tracks.length > 0}
                      onCheckedChange={toggleAll}
                      className="h-3.5 w-3.5 border-zinc-600"
                    />
                  </TableHead>
                  <TableHead className="text-[11px] tracking-wider text-zinc-500 uppercase">
                    Game
                  </TableHead>
                  <TableHead className="w-10 text-[11px] tracking-wider text-zinc-500 uppercase">
                    #
                  </TableHead>
                  <TableHead className="w-10 text-[11px] tracking-wider text-zinc-500 uppercase">
                    On
                  </TableHead>
                  <TableHead className="text-[11px] tracking-wider text-zinc-500 uppercase">
                    Name
                  </TableHead>
                  <TableHead className="w-16 text-[11px] tracking-wider text-zinc-500 uppercase">
                    Energy
                  </TableHead>
                  <TableHead className="text-[11px] tracking-wider text-zinc-500 uppercase">
                    Role
                  </TableHead>
                  <TableHead className="text-[11px] tracking-wider text-zinc-500 uppercase">
                    Moods
                  </TableHead>
                  <TableHead className="text-[11px] tracking-wider text-zinc-500 uppercase">
                    Instruments
                  </TableHead>
                  <TableHead className="w-14 text-[11px] tracking-wider text-zinc-500 uppercase">
                    Vocals
                  </TableHead>
                  <TableHead className="w-10 text-[11px] tracking-wider text-zinc-500 uppercase">
                    YT
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tracks.map((track) => {
                  const key = trackKey(track);
                  const isSelected = selected.has(key);
                  return (
                    <TableRow
                      key={key}
                      className={`cursor-pointer border-zinc-800/60 ${isSelected ? "bg-violet-500/5" : "hover:bg-zinc-800/30"}`}
                      onClick={() => setEditTrack(track)}
                    >
                      <TableCell
                        className="px-2 py-2"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleOne(track);
                        }}
                      >
                        <Checkbox checked={isSelected} className="h-3.5 w-3.5 border-zinc-600" />
                      </TableCell>
                      <TableCell className="max-w-[160px] truncate py-2 text-xs text-zinc-400">
                        {track.gameTitle}
                      </TableCell>
                      <TableCell className="py-2 font-mono text-[11px] text-zinc-500">
                        {track.position}
                      </TableCell>
                      <TableCell className="py-2 text-center">
                        <span className={track.active ? "text-emerald-400" : "text-zinc-600"}>
                          {track.active ? "●" : "○"}
                        </span>
                      </TableCell>
                      <TableCell className="py-2 text-sm text-zinc-200">{track.name}</TableCell>
                      <TableCell className="py-2">
                        <EnergyBadge energy={track.energy} />
                      </TableCell>
                      <TableCell className="py-2">
                        <TagBadgeList tags={track.roles} maxVisible={2} />
                      </TableCell>
                      <TableCell className="py-2">
                        <TagBadgeList tags={track.moods} maxVisible={2} />
                      </TableCell>
                      <TableCell className="py-2">
                        <TagBadgeList tags={track.instrumentation} maxVisible={2} />
                      </TableCell>
                      <TableCell className="py-2 text-center font-mono text-[11px] text-zinc-500">
                        {track.hasVocals === null ? "—" : track.hasVocals ? "yes" : "no"}
                      </TableCell>
                      <TableCell className="py-2 text-center" onClick={(e) => e.stopPropagation()}>
                        {track.videoId ? (
                          <a
                            href={`https://www.youtube.com/watch?v=${track.videoId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-zinc-500 transition-colors hover:text-zinc-300"
                            title="Open on YouTube"
                          >
                            ▶
                          </a>
                        ) : (
                          <span className="text-zinc-700">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )
      )}

      {/* Bulk action bar */}
      <BulkActionBar
        selectedCount={selected.size}
        onSetEnergy={bulkSetEnergy}
        onSetRole={bulkSetRole}
        onActivate={() => bulkSetActive(true)}
        onDeactivate={() => bulkSetActive(false)}
        onMarkReviewed={bulkMarkReviewed}
        onDelete={() => setDeleteModalOpen(true)}
      />

      {/* Delete confirmation */}
      <ConfirmModal
        open={deleteModalOpen}
        onOpenChange={setDeleteModalOpen}
        title="Delete selected tracks"
        description={`This will permanently delete ${selected.size} track${selected.size === 1 ? "" : "s"}. This cannot be undone.`}
        confirmLabel="Delete"
        destructive
        onConfirm={bulkDelete}
      />

      {/* Track edit sheet */}
      {editTrack && (
        <TrackEditSheet
          key={trackKey(editTrack)}
          track={editTrack}
          videoMeta={
            editTrack.videoId
              ? {
                  videoId: editTrack.videoId,
                  durationSeconds: editTrack.durationSeconds,
                  viewCount: editTrack.viewCount,
                }
              : null
          }
          open={!!editTrack}
          onOpenChange={(open) => {
            if (!open) setEditTrack(null);
          }}
          onSave={handleTrackSave}
        />
      )}
    </div>
  );
}

// ─── Query param helpers ──────────────────────────────────────────────────────

function buildApiParams(
  search: string,
  gameSearch: string,
  tab: string,
  filters: ActiveFilter[],
  overrideGameId?: string,
): URLSearchParams {
  const params = new URLSearchParams();

  if (overrideGameId) {
    params.set("gameId", overrideGameId);
  } else if (gameSearch.trim()) {
    params.set("gameTitle", gameSearch.trim());
  }
  if (search.trim()) params.set("name", search.trim());

  // Tab presets
  const preset = TAB_PRESETS.find((p) => p.tab.value === tab);
  if (preset) {
    for (const [k, v] of Object.entries(preset.params)) {
      params.set(k, v);
    }
  }

  // Filter chips override tab presets
  for (const f of filters) {
    params.set(f.key, f.value);
  }

  return params;
}

function buildUrlParams(
  search: string,
  gameSearch: string,
  tab: string,
  filters: ActiveFilter[],
): URLSearchParams {
  const params = new URLSearchParams();
  if (gameSearch.trim()) params.set("gameTitle", gameSearch.trim());
  if (search.trim()) params.set("name", search.trim());

  const preset = TAB_PRESETS.find((p) => p.tab.value === tab);
  if (preset) {
    for (const [k, v] of Object.entries(preset.params)) {
      params.set(k, v);
    }
  }
  for (const f of filters) {
    params.set(f.key, f.value);
  }

  return params;
}

function deriveTabFromParams(sp: URLSearchParams): string {
  const filterKeys = new Set(TRACK_FILTER_DEFS.map((d) => d.key));
  const urlFilterKeys = [...sp.keys()].filter((k) => filterKeys.has(k));

  for (const preset of TAB_PRESETS) {
    if (preset.tab.value === "all") continue;
    const presetKeys = Object.keys(preset.params);
    if (presetKeys.length !== urlFilterKeys.length) continue;
    const matches =
      presetKeys.every((k) => sp.get(k) === preset.params[k]) &&
      urlFilterKeys.every((k) => k in preset.params);
    if (matches) return preset.tab.value;
  }
  return "all";
}

function deriveFiltersFromParams(sp: URLSearchParams): ActiveFilter[] {
  const filters: ActiveFilter[] = [];
  const tab = deriveTabFromParams(sp);
  if (tab !== "all") return [];

  for (const def of TRACK_FILTER_DEFS) {
    const val = sp.get(def.key);
    if (val && def.options.some((o) => o.value === val)) {
      filters.push({ key: def.key, value: val });
    }
  }
  return filters;
}
