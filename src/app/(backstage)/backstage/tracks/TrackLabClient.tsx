"use client";

import { useState, useCallback } from "react";
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
import { BulkActionBar } from "@/components/backstage/BulkActionBar";
import { ConfirmModal } from "@/components/backstage/ConfirmModal";
import { QuickViewTabs } from "@/components/backstage/QuickViewTabs";
import { FilterChipBar } from "@/components/backstage/FilterChipBar";
import { useFilteredList } from "@/hooks/backstage/useFilteredList";
import type { TabPreset } from "@/hooks/backstage/useFilteredList";
import type { FilterDef } from "@/components/backstage/FilterChipBar";
import type { BackstageTrackRow } from "@/lib/db/repos/tracks";
import { useTrackSelection, trackKey } from "./_hooks/useTrackSelection";
import { useTrackMutations } from "./_hooks/useTrackMutations";

// ─── Tab presets ────────────────────────────────────────────────────────────

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

// ─── Component ──────────────────────────────────────────────────────────────

export function TrackLabClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // ?game=<id> comes from Game Hub "View in Track Lab" link — exact game ID match (one-time)
  const initialGameId = searchParams.get("game") ?? undefined;

  const fetchTracks = useCallback(async (params: URLSearchParams) => {
    const res = await fetch(`/api/backstage/tracks?${params}`);
    if (!res.ok) throw new Error(`Server error: HTTP ${res.status}`);
    return (await res.json()) as BackstageTrackRow[];
  }, []);

  const {
    searchValues,
    handleSearchChange,
    activeTab,
    handleTabChange,
    effectiveFilters,
    handleFilterChange,
    resetFilters,
    items: tracks,
    isLoading: loading,
    hasSearched,
    fetchError,
    refetch,
  } = useFilteredList<BackstageTrackRow>({
    tabPresets: TAB_PRESETS,
    filterDefs: TRACK_FILTER_DEFS,
    urlPath: "/backstage/tracks",
    searchParamKeys: ["name", "gameTitle"],
    fetchFn: fetchTracks,
    initialOverrides: initialGameId ? { gameId: initialGameId } : undefined,
  });

  const { selected, setSelected, allSelected, toggleAll, toggleOne } = useTrackSelection(tracks);
  const [editTrack, setEditTrack] = useState<BackstageTrackRow | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [mutError, setMutError] = useState<string | null>(null);

  const mutations = useTrackMutations({
    tracks,
    selected,
    setMutError,
    setDeleteModalOpen,
    refetch,
    router,
  });

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Quick-view tabs */}
      <QuickViewTabs
        tabs={TAB_PRESETS.map((p) => p.tab)}
        active={activeTab}
        onChange={(tab) => {
          setSelected(new Set());
          handleTabChange(tab);
        }}
      />

      {/* Search + filters */}
      <div className="flex items-center gap-2">
        <div className="relative w-52">
          <Search className="absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-tertiary)]" />
          <Input
            placeholder="Search by track name..."
            value={searchValues.name ?? ""}
            onChange={(e) => handleSearchChange("name", e.target.value)}
            className="border-border bg-secondary text-foreground focus-visible:ring-ring/50 h-8 pl-8 text-xs placeholder:text-[var(--text-disabled)]"
          />
        </div>
        <div className="relative w-44">
          <Search className="absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-tertiary)]" />
          <Input
            placeholder="Filter by game..."
            value={searchValues.gameTitle ?? ""}
            onChange={(e) => handleSearchChange("gameTitle", e.target.value)}
            className="border-border bg-secondary text-foreground focus-visible:ring-ring/50 h-8 pl-8 text-xs placeholder:text-[var(--text-disabled)]"
          />
        </div>
        {hasSearched && (
          <span className="ml-auto font-mono text-xs whitespace-nowrap text-[var(--text-disabled)]">
            {tracks.length} result{tracks.length === 1 ? "" : "s"}
          </span>
        )}
      </div>

      {/* Filters */}
      <FilterChipBar
        filters={effectiveFilters}
        definitions={TRACK_FILTER_DEFS}
        onChange={handleFilterChange}
        onReset={resetFilters}
      />

      {fetchError && <p className="text-xs text-rose-400">{fetchError}</p>}
      {mutError && <p className="text-xs text-rose-400">{mutError}</p>}

      {/* Results */}
      {tracks.length === 0 && hasSearched ? (
        <p className="py-10 text-center text-xs text-[var(--text-disabled)]">
          No tracks match the current filters.
        </p>
      ) : (
        hasSearched && (
          <div
            className={`border-border overflow-hidden rounded-lg border transition-opacity ${loading ? "opacity-60" : ""}`}
          >
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="w-8 px-2">
                    <Checkbox
                      checked={allSelected && tracks.length > 0}
                      onCheckedChange={toggleAll}
                      className="h-3.5 w-3.5 border-[var(--border-emphasis)]"
                    />
                  </TableHead>
                  <TableHead className="text-[11px] tracking-wider text-[var(--text-tertiary)] uppercase">
                    Game
                  </TableHead>
                  <TableHead className="w-10 text-[11px] tracking-wider text-[var(--text-tertiary)] uppercase">
                    #
                  </TableHead>
                  <TableHead className="w-10 text-[11px] tracking-wider text-[var(--text-tertiary)] uppercase">
                    On
                  </TableHead>
                  <TableHead className="text-[11px] tracking-wider text-[var(--text-tertiary)] uppercase">
                    Name
                  </TableHead>
                  <TableHead className="w-16 text-[11px] tracking-wider text-[var(--text-tertiary)] uppercase">
                    Energy
                  </TableHead>
                  <TableHead className="text-[11px] tracking-wider text-[var(--text-tertiary)] uppercase">
                    Role
                  </TableHead>
                  <TableHead className="text-[11px] tracking-wider text-[var(--text-tertiary)] uppercase">
                    Moods
                  </TableHead>
                  <TableHead className="text-[11px] tracking-wider text-[var(--text-tertiary)] uppercase">
                    Instruments
                  </TableHead>
                  <TableHead className="w-14 text-[11px] tracking-wider text-[var(--text-tertiary)] uppercase">
                    Vocals
                  </TableHead>
                  <TableHead className="w-10 text-[11px] tracking-wider text-[var(--text-tertiary)] uppercase">
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
                      className={`border-border/60 cursor-pointer ${isSelected ? "bg-primary/5" : "hover:bg-secondary/30"}`}
                      onClick={() => setEditTrack(track)}
                    >
                      <TableCell
                        className="px-2 py-2"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleOne(track);
                        }}
                      >
                        <Checkbox
                          checked={isSelected}
                          className="h-3.5 w-3.5 border-[var(--border-emphasis)]"
                        />
                      </TableCell>
                      <TableCell className="text-muted-foreground max-w-[160px] truncate py-2 text-xs">
                        {track.gameTitle}
                      </TableCell>
                      <TableCell className="py-2 font-mono text-[11px] text-[var(--text-tertiary)]">
                        {track.position}
                      </TableCell>
                      <TableCell className="py-2 text-center">
                        <span
                          className={
                            track.active ? "text-emerald-400" : "text-[var(--text-disabled)]"
                          }
                        >
                          {track.active ? "●" : "○"}
                        </span>
                      </TableCell>
                      <TableCell className="text-foreground py-2 text-sm">{track.name}</TableCell>
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
                      <TableCell className="py-2 text-center font-mono text-[11px] text-[var(--text-tertiary)]">
                        {track.hasVocals === null ? "—" : track.hasVocals ? "yes" : "no"}
                      </TableCell>
                      <TableCell className="py-2 text-center" onClick={(e) => e.stopPropagation()}>
                        {track.videoId ? (
                          <a
                            href={`https://www.youtube.com/watch?v=${track.videoId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:text-foreground text-[var(--text-tertiary)] transition-colors"
                            title="Open on YouTube"
                          >
                            ▶
                          </a>
                        ) : (
                          <span className="text-[var(--text-disabled)]">—</span>
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
        onSetEnergy={mutations.bulkSetEnergy}
        onSetRole={mutations.bulkSetRole}
        onActivate={() => mutations.bulkSetActive(true)}
        onDeactivate={() => mutations.bulkSetActive(false)}
        onMarkReviewed={mutations.bulkMarkReviewed}
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
        onConfirm={mutations.bulkDelete}
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
          onSave={mutations.handleTrackSave}
        />
      )}
    </div>
  );
}
