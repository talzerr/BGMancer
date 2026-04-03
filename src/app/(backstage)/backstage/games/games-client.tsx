"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Search } from "lucide-react";
import { StatusBadge } from "@/components/backstage/StatusBadge";
import { QuickViewTabs } from "@/components/backstage/QuickViewTabs";
import { FilterChipBar } from "@/components/backstage/FilterChipBar";
import { AddGameDialog } from "@/components/backstage/AddGameDialog";
import { useFilteredList } from "@/hooks/backstage/useFilteredList";
import type { TabPreset } from "@/hooks/backstage/useFilteredList";
import type { FilterDef } from "@/components/backstage/FilterChipBar";
import { OnboardingPhase } from "@/types";
import type { BackstageGame } from "@/lib/db/repos/backstage-games";
import { gameSlug } from "@/lib/utils";

// ─── Tab presets ────────────────────────────────────────────────────────────

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

  const fetchGames = useCallback(async (params: URLSearchParams) => {
    const res = await fetch(`/api/backstage/games?${params}`);
    if (!res.ok) throw new Error(`Server error: HTTP ${res.status}`);
    return (await res.json()) as BackstageGame[];
  }, []);

  const {
    searchValues,
    handleSearchChange,
    activeTab,
    handleTabChange,
    effectiveFilters,
    handleFilterChange,
    resetFilters,
    items: games,
    loading,
    hasSearched,
    fetchError,
    refetch,
  } = useFilteredList<BackstageGame>({
    tabPresets: TAB_PRESETS,
    filterDefs: GAME_FILTER_DEFS,
    urlPath: "/backstage/games",
    searchParamKeys: ["title"],
    fetchFn: fetchGames,
  });

  // Add Game dialog
  const [addDialogOpen, setAddDialogOpen] = useState(false);

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkPublishing, setBulkPublishing] = useState(false);

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
      await refetch();
    } catch (err) {
      console.error("[GamesClient] bulk publish failed:", err);
    } finally {
      setBulkPublishing(false);
    }
  }

  // ─── Derived state ───────────────────────────────────────────────────────

  const reviewCount = games.filter((g) => g.reviewFlagCount > 0).length;
  const tabs = TAB_PRESETS.map((p) => ({
    ...p.tab,
    count: p.tab.value === "needs-review" && activeTab === "all" ? reviewCount : undefined,
  }));

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="space-y-3">
      {/* Quick-view tabs */}
      <QuickViewTabs
        tabs={tabs}
        active={activeTab}
        onChange={(tab) => {
          setSelectedIds(new Set());
          handleTabChange(tab);
        }}
      />

      {/* Search + actions */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
          <Input
            placeholder="Search by title..."
            value={searchValues.title ?? ""}
            onChange={(e) => handleSearchChange("title", e.target.value)}
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
        onReset={resetFilters}
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
      <AddGameDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        onCreated={(game) => router.push(`/backstage/games/${gameSlug(game.title, game.id)}`)}
      />
    </div>
  );
}
