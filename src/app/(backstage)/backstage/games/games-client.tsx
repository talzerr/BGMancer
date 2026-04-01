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
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Search } from "lucide-react";
import { StatusBadge } from "@/components/backstage/StatusBadge";
import { QuickViewTabs } from "@/components/backstage/QuickViewTabs";
import type { QuickViewTab } from "@/components/backstage/QuickViewTabs";
import { FilterChipBar } from "@/components/backstage/FilterChipBar";
import type { FilterDef, ActiveFilter } from "@/components/backstage/FilterChipBar";
import { OnboardingPhase } from "@/types";
import type { BackstageGame } from "@/lib/db/repos/backstage-games";
import { gameSlug } from "@/lib/utils";

// ─── Tab presets ────────────────────────────────────────────────────────────

interface TabPreset {
  tab: QuickViewTab;
  params: Record<string, string>;
}

const TAB_PRESETS: TabPreset[] = [
  { tab: { label: "All", value: "all" }, params: {} },
  { tab: { label: "Needs Review", value: "needs-review" }, params: { needsReview: "1" } },
  { tab: { label: "Drafts", value: "drafts" }, params: { phase: "draft" } },
  { tab: { label: "Published", value: "published" }, params: { published: "1" } },
];

// ─── Filter definitions ─────────────────────────────────────────────────────

const PHASE_LABELS: Record<string, string> = {
  [OnboardingPhase.Draft]: "Draft",
  [OnboardingPhase.TracksLoaded]: "Tracks Loaded",
  [OnboardingPhase.Tagged]: "Ready",
  [OnboardingPhase.Resolved]: "Resolved",
  [OnboardingPhase.Failed]: "Failed",
};

const GAME_FILTER_DEFS: FilterDef[] = [
  {
    key: "phase",
    label: "Phase",
    options: Object.values(OnboardingPhase).map((p) => ({
      label: PHASE_LABELS[p] ?? p,
      value: p,
    })),
  },
  {
    key: "published",
    label: "Published",
    options: [
      { label: "Yes", value: "1" },
      { label: "No", value: "0" },
    ],
  },
  {
    key: "needsReview",
    label: "Needs Review",
    options: [
      { label: "Yes", value: "1" },
      { label: "No", value: "0" },
    ],
  },
];

// ─── Component ──────────────────────────────────────────────────────────────

export function GamesClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Search
  const [titleSearch, setTitleSearch] = useState(() => searchParams.get("title") ?? "");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Tabs + filter chips
  const [activeTab, setActiveTab] = useState(() => deriveTabFromParams(searchParams));
  const [activeFilters, setActiveFilters] = useState<ActiveFilter[]>(() =>
    deriveFiltersFromParams(searchParams),
  );

  // Results
  const [games, setGames] = useState<BackstageGame[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Add Game dialog
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newSteamAppid, setNewSteamAppid] = useState("");
  const [creating, setCreating] = useState(false);
  const [steamQuery, setSteamQuery] = useState("");
  const [steamResults, setSteamResults] = useState<
    { appid: number; name: string; tiny_image: string }[]
  >([]);
  const [steamSearching, setSteamSearching] = useState(false);
  const steamDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkPublishing, setBulkPublishing] = useState(false);

  // ─── Fetch logic ────────────────────────────────────────────────────────

  const fetchGames = useCallback(
    async (search?: string, tab?: string, filters?: ActiveFilter[]) => {
      const s = search ?? titleSearch;
      const t = tab ?? activeTab;
      const f = filters ?? activeFilters;

      setLoading(true);
      setFetchError(null);

      const params = buildQueryParams(s, t, f);
      router.replace(`/backstage/games${params.size ? `?${params}` : ""}`, { scroll: false });

      try {
        const res = await fetch(`/api/backstage/games?${params}`);
        if (!res.ok) throw new Error(`Server error: HTTP ${res.status}`);
        const data = (await res.json()) as BackstageGame[];
        setGames(data);
        setHasSearched(true);
      } catch (err) {
        console.error("[GamesClient] fetchGames failed:", err);
        setFetchError("Failed to load games. Try again.");
        setHasSearched(true);
      } finally {
        setLoading(false);
      }
    },
    [titleSearch, activeTab, activeFilters, router],
  );

  // Auto-fetch on mount
  useEffect(() => {
    Promise.resolve().then(() => fetchGames());
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Debounced search ───────────────────────────────────────────────────

  function handleSearchChange(value: string) {
    setTitleSearch(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchGames(value);
    }, 300);
  }

  // ─── Tab switching ──────────────────────────────────────────────────────

  function handleTabChange(tab: string) {
    setActiveTab(tab);
    setActiveFilters([]);
    setSelectedIds(new Set());
    fetchGames(titleSearch, tab, []);
  }

  // ─── Filter handlers ────────────────────────────────────────────────────

  function handleFilterChange(key: string, value: string) {
    let next: ActiveFilter[];
    if (value === "") {
      // Clear this filter
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
    fetchGames(titleSearch, "all", next);
  }

  // ─── Steam search ──────────────────────────────────────────────────────

  function handleSteamSearch(query: string) {
    setSteamQuery(query);
    if (steamDebounceRef.current) clearTimeout(steamDebounceRef.current);
    if (query.trim().length < 2) {
      setSteamResults([]);
      return;
    }
    steamDebounceRef.current = setTimeout(async () => {
      setSteamSearching(true);
      try {
        const res = await fetch(`/api/steam/search?q=${encodeURIComponent(query.trim())}`);
        if (res.ok) {
          const data = (await res.json()) as {
            results?: { appid: number; name: string; tiny_image: string }[];
          };
          setSteamResults(data.results ?? []);
        }
      } catch {
        /* non-critical */
      } finally {
        setSteamSearching(false);
      }
    }, 300);
  }

  function selectSteamResult(result: { appid: number; name: string }) {
    setNewTitle(result.name);
    setNewSteamAppid(String(result.appid));
    setSteamQuery("");
    setSteamResults([]);
  }

  function resetAddDialog() {
    setNewTitle("");
    setNewSteamAppid("");
    setSteamQuery("");
    setSteamResults([]);
  }

  // ─── Create game ───────────────────────────────────────────────────────

  async function handleCreateGame() {
    if (!newTitle.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/backstage/games", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle.trim(),
          steamAppid: newSteamAppid ? Number(newSteamAppid) : undefined,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const game = (await res.json()) as { id: string; title: string };
      setAddDialogOpen(false);
      resetAddDialog();
      router.push(`/backstage/games/${gameSlug(game.title, game.id)}`);
    } catch (err) {
      console.error("[GamesClient] create failed:", err);
    } finally {
      setCreating(false);
    }
  }

  // ─── Bulk selection ─────────────────────────────────────────────────────

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedIds.size === games.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(games.map((g) => g.id)));
    }
  }

  async function handleBulkPublish(published: boolean) {
    if (selectedIds.size === 0) return;
    setBulkPublishing(true);
    try {
      const res = await fetch("/api/backstage/bulk-publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameIds: [...selectedIds], published }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setSelectedIds(new Set());
      await fetchGames();
    } catch (err) {
      console.error("[GamesClient] bulk publish failed:", err);
    } finally {
      setBulkPublishing(false);
    }
  }

  // ─── Derived state ───────────────────────────────────────────────────────

  const reviewCount = games.filter((g) => g.reviewFlagCount > 0).length;
  const tabs: QuickViewTab[] = TAB_PRESETS.map((p) => ({
    ...p.tab,
    count: p.tab.value === "needs-review" && activeTab === "all" ? reviewCount : undefined,
  }));

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

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="space-y-3">
      {/* Quick-view tabs */}
      <QuickViewTabs tabs={tabs} active={activeTab} onChange={handleTabChange} />

      {/* Search + actions */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
          <Input
            placeholder="Search by title..."
            value={titleSearch}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="h-8 border-zinc-700 bg-zinc-900 pl-8 text-xs text-zinc-200 placeholder:text-zinc-600 focus-visible:ring-violet-500/50"
          />
        </div>
        <div className="flex items-center gap-2">
          {hasSearched && (
            <span className="font-mono text-xs whitespace-nowrap text-zinc-600">
              {games.length} result{games.length === 1 ? "" : "s"}
            </span>
          )}
          <Button
            size="sm"
            className="h-8 bg-violet-600 px-3 text-xs whitespace-nowrap text-white hover:bg-violet-500"
            onClick={() => setAddDialogOpen(true)}
          >
            + Add Game
          </Button>
        </div>
      </div>

      {/* Filters */}
      <FilterChipBar
        filters={effectiveFilters}
        definitions={GAME_FILTER_DEFS}
        onChange={handleFilterChange}
        onReset={() => {
          setActiveFilters([]);
          setActiveTab("all");
          fetchGames(titleSearch, "all", []);
        }}
      />

      {fetchError && <p className="text-xs text-rose-400">{fetchError}</p>}

      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-2 rounded-md border border-violet-500/30 bg-violet-500/5 px-3 py-2">
          <span className="text-xs text-violet-300">{selectedIds.size} selected</span>
          <div className="ml-auto flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="h-7 border-emerald-600/40 px-3 text-xs text-emerald-400 hover:bg-emerald-500/10"
              onClick={() => handleBulkPublish(true)}
              disabled={bulkPublishing}
            >
              Publish
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 border-zinc-600 px-3 text-xs text-zinc-400 hover:bg-zinc-800"
              onClick={() => handleBulkPublish(false)}
              disabled={bulkPublishing}
            >
              Unpublish
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs text-zinc-500 hover:text-zinc-300"
              onClick={() => setSelectedIds(new Set())}
            >
              Clear
            </Button>
          </div>
        </div>
      )}

      {/* Results */}
      {games.length === 0 && hasSearched ? (
        <p className="py-10 text-center text-xs text-zinc-600">
          No games match the current filters.
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
                      checked={games.length > 0 && selectedIds.size === games.length}
                      onCheckedChange={toggleSelectAll}
                      className="h-3.5 w-3.5 border-zinc-600 data-[state=checked]:border-violet-500 data-[state=checked]:bg-violet-500"
                    />
                  </TableHead>
                  <TableHead className="text-[11px] tracking-wider text-zinc-500 uppercase">
                    Title
                  </TableHead>
                  <TableHead className="text-[11px] tracking-wider text-zinc-500 uppercase">
                    Phase
                  </TableHead>
                  <TableHead className="text-[11px] tracking-wider text-zinc-500 uppercase">
                    Tracks
                  </TableHead>
                  <TableHead className="text-[11px] tracking-wider text-zinc-500 uppercase">
                    Tagged
                  </TableHead>
                  <TableHead className="text-[11px] tracking-wider text-zinc-500 uppercase">
                    Review
                  </TableHead>
                  <TableHead className="text-[11px] tracking-wider text-zinc-500 uppercase">
                    Source
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {games.map((game) => {
                  const href = `/backstage/games/${gameSlug(game.title, game.id)}`;
                  return (
                    <TableRow
                      key={game.id}
                      className="cursor-pointer border-zinc-800/60 hover:bg-zinc-800/30"
                    >
                      <TableCell className="w-8 px-2 py-2.5" onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedIds.has(game.id)}
                          onCheckedChange={() => toggleSelect(game.id)}
                          className="h-3.5 w-3.5 border-zinc-600 data-[state=checked]:border-violet-500 data-[state=checked]:bg-violet-500"
                        />
                      </TableCell>
                      <TableCell
                        className="py-2.5 text-sm text-zinc-200"
                        onClick={() => router.push(href)}
                      >
                        {game.title}
                        {game.published && (
                          <span className="ml-2 text-[10px] text-emerald-500/70">●</span>
                        )}
                      </TableCell>
                      <TableCell className="py-2.5" onClick={() => router.push(href)}>
                        <StatusBadge phase={game.onboarding_phase} />
                      </TableCell>
                      <TableCell
                        className="py-2.5 font-mono text-xs text-zinc-400"
                        onClick={() => router.push(href)}
                      >
                        {game.activeCount}/{game.trackCount}
                      </TableCell>
                      <TableCell
                        className="py-2.5 font-mono text-xs text-zinc-400"
                        onClick={() => router.push(href)}
                      >
                        {game.taggedCount}
                        {game.trackCount > 0 && (
                          <span className="ml-1 text-zinc-600">
                            ({Math.round((game.taggedCount / game.trackCount) * 100)}%)
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="py-2.5" onClick={() => router.push(href)}>
                        {game.reviewFlagCount > 0 ? (
                          <span className="font-mono text-xs text-amber-400">
                            {game.reviewFlagCount}
                          </span>
                        ) : (
                          <span className="text-zinc-700">—</span>
                        )}
                      </TableCell>
                      <TableCell
                        className="py-2.5 font-mono text-[11px] text-zinc-500"
                        onClick={() => router.push(href)}
                      >
                        {game.tracklist_source ?? "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )
      )}

      {/* Add Game dialog */}
      <Dialog
        open={addDialogOpen}
        onOpenChange={(v) => {
          setAddDialogOpen(v);
          if (!v) resetAddDialog();
        }}
      >
        <DialogContent className="border-zinc-800 bg-zinc-900 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-zinc-100">Add Game</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {/* Steam search */}
            <div className="space-y-1.5">
              <label className="text-xs text-zinc-400">Search Steam</label>
              <Input
                value={steamQuery}
                onChange={(e) => handleSteamSearch(e.target.value)}
                placeholder="Type to search Steam..."
                className="border-zinc-700 bg-zinc-800 text-zinc-100 placeholder:text-zinc-600"
                autoFocus
              />
              {steamSearching && <p className="text-[11px] text-zinc-500">Searching…</p>}
              {steamResults.length > 0 && (
                <div className="max-h-48 overflow-y-auto rounded border border-zinc-700 bg-zinc-800/80">
                  {steamResults.map((r) => (
                    <button
                      key={r.appid}
                      type="button"
                      onClick={() => selectSteamResult(r)}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-zinc-200 transition-colors hover:bg-zinc-700"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={r.tiny_image}
                        alt=""
                        className="h-[22px] w-[30px] shrink-0 rounded object-cover"
                      />
                      <span className="min-w-0 truncate">{r.name}</span>
                      <span className="ml-auto shrink-0 font-mono text-[10px] text-zinc-500">
                        {r.appid}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <div className="h-px flex-1 bg-zinc-800" />
              <span className="text-[10px] text-zinc-600">or enter manually</span>
              <div className="h-px flex-1 bg-zinc-800" />
            </div>

            {/* Manual entry */}
            <div className="space-y-1.5">
              <label className="text-xs text-zinc-400">Title</label>
              <Input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="e.g. Hollow Knight"
                className="border-zinc-700 bg-zinc-800 text-zinc-100 placeholder:text-zinc-600"
                onKeyDown={(e) => e.key === "Enter" && handleCreateGame()}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-zinc-400">Steam App ID (optional)</label>
              <Input
                value={newSteamAppid}
                onChange={(e) => setNewSteamAppid(e.target.value.replace(/\D/g, ""))}
                placeholder="e.g. 367520"
                className="border-zinc-700 bg-zinc-800 font-mono text-zinc-100 placeholder:text-zinc-600"
                onKeyDown={(e) => e.key === "Enter" && handleCreateGame()}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              className="bg-violet-600 text-white hover:bg-violet-500"
              onClick={handleCreateGame}
              disabled={!newTitle.trim() || creating}
            >
              {creating ? "Creating…" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildQueryParams(search: string, tab: string, filters: ActiveFilter[]): URLSearchParams {
  const params = new URLSearchParams();
  if (search.trim()) params.set("title", search.trim());

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

function deriveTabFromParams(sp: URLSearchParams): string {
  // Only match a tab if the URL's filter params exactly equal the preset (no extra filters).
  // Ignore non-filter params like "title" when comparing.
  const filterKeys = new Set(GAME_FILTER_DEFS.map((d) => d.key));
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
  // Only derive chip filters if we're on the "all" tab (otherwise tab presets handle it)
  const tab = deriveTabFromParams(sp);
  if (tab !== "all") return [];

  for (const def of GAME_FILTER_DEFS) {
    const val = sp.get(def.key);
    if (val && def.options.some((o) => o.value === val)) {
      filters.push({ key: def.key, value: val });
    }
  }
  return filters;
}
