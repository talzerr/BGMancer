"use client";

import { useState, useCallback, useEffect } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { EnergyBadge } from "@/components/backstage/EnergyBadge";
import { TagBadgeList } from "@/components/backstage/TagBadgeList";
import { TrackEditSheet } from "@/components/backstage/TrackEditSheet";
import type { PatchUpdates } from "@/components/backstage/TrackEditSheet";
import { BulkActionBar } from "@/components/backstage/BulkActionBar";
import { ConfirmModal } from "@/components/backstage/ConfirmModal";
import type { BackstageTrackRow } from "@/lib/db/repos/tracks";
import type { Track } from "@/types";

type TrackKey = `${string}::${string}`;

function trackKey(t: { gameId: string; name: string }): TrackKey {
  return `${t.gameId}::${t.name}`;
}

export function TrackLabClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [search, setSearch] = useState(() => searchParams.get("name") ?? "");
  const [gameSearch, setGameSearch] = useState(() => searchParams.get("gameTitle") ?? "");
  const [energyFilter, setEnergyFilter] = useState(() => searchParams.get("energy") ?? "all");
  const [activeFilter, setActiveFilter] = useState(() => {
    const a = searchParams.get("active");
    return a === "1" ? "active" : a === "0" ? "inactive" : "all";
  });
  const [untaggedOnly, setUntaggedOnly] = useState(() => searchParams.get("untagged") === "1");
  // ?game=<id> comes from Game Hub "View in Track Lab" link — exact game ID match
  const initialGameId = searchParams.get("game") ?? undefined;

  const [tracks, setTracks] = useState<BackstageTrackRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [mutError, setMutError] = useState<string | null>(null);

  const [selected, setSelected] = useState<Set<TrackKey>>(new Set());
  const [editTrack, setEditTrack] = useState<Track | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);

  const fetchTracks = useCallback(
    async (overrideGameId?: string) => {
      setLoading(true);
      setSelected(new Set());
      setFetchError(null);

      const apiParams = new URLSearchParams();
      if (overrideGameId) {
        apiParams.set("gameId", overrideGameId);
      } else if (gameSearch.trim()) {
        apiParams.set("gameTitle", gameSearch.trim());
      }
      if (search.trim()) apiParams.set("name", search.trim());
      if (energyFilter !== "all") apiParams.set("energy", energyFilter);
      if (activeFilter === "active") apiParams.set("active", "1");
      if (activeFilter === "inactive") apiParams.set("active", "0");
      if (untaggedOnly) apiParams.set("untaggedOnly", "1");

      // Sync URL (skip the gameId override — that's a one-time Game Hub link)
      if (!overrideGameId) {
        const urlParams = new URLSearchParams();
        if (gameSearch.trim()) urlParams.set("gameTitle", gameSearch.trim());
        if (search.trim()) urlParams.set("name", search.trim());
        if (energyFilter !== "all") urlParams.set("energy", energyFilter);
        if (activeFilter === "active") urlParams.set("active", "1");
        if (activeFilter === "inactive") urlParams.set("active", "0");
        if (untaggedOnly) urlParams.set("untagged", "1");
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
    [gameSearch, search, energyFilter, activeFilter, untaggedOnly, router],
  );

  // Auto-fetch on mount if URL has params
  useEffect(() => {
    if (searchParams.size > 0) {
      Promise.resolve().then(() => fetchTracks(initialGameId));
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Selection helpers
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

  // Mutations
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
    await patchTracks([{ gameId, name, updates }]);
  }

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Search by track name…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && fetchTracks()}
          className="h-8 w-52 border-zinc-700 bg-zinc-900 text-xs text-zinc-200 placeholder:text-zinc-600 focus-visible:ring-violet-500/50"
        />
        <Input
          placeholder="Filter by game…"
          value={gameSearch}
          onChange={(e) => setGameSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && fetchTracks()}
          className="h-8 w-44 border-zinc-700 bg-zinc-900 text-xs text-zinc-200 placeholder:text-zinc-600 focus-visible:ring-violet-500/50"
        />
        <Select value={energyFilter} onValueChange={(v) => setEnergyFilter(v ?? "all")}>
          <SelectTrigger className="h-8 w-32 border-zinc-700 bg-zinc-900 text-xs text-zinc-400">
            <SelectValue placeholder="All energy" />
          </SelectTrigger>
          <SelectContent className="border-zinc-700 bg-zinc-900">
            <SelectItem value="all" className="text-xs text-zinc-400">
              All energy
            </SelectItem>
            <SelectItem value="1" className="text-xs">
              1 — Calm
            </SelectItem>
            <SelectItem value="2" className="text-xs">
              2 — Moderate
            </SelectItem>
            <SelectItem value="3" className="text-xs">
              3 — Intense
            </SelectItem>
          </SelectContent>
        </Select>
        <Select value={activeFilter} onValueChange={(v) => setActiveFilter(v ?? "all")}>
          <SelectTrigger className="h-8 w-28 border-zinc-700 bg-zinc-900 text-xs text-zinc-400">
            <SelectValue placeholder="All" />
          </SelectTrigger>
          <SelectContent className="border-zinc-700 bg-zinc-900">
            <SelectItem value="all" className="text-xs text-zinc-400">
              All
            </SelectItem>
            <SelectItem value="active" className="text-xs">
              Active
            </SelectItem>
            <SelectItem value="inactive" className="text-xs">
              Inactive
            </SelectItem>
          </SelectContent>
        </Select>
        <label className="flex cursor-pointer items-center gap-2 text-xs text-zinc-500 select-none">
          <Checkbox
            checked={untaggedOnly}
            onCheckedChange={(v) => setUntaggedOnly(!!v)}
            className="h-3.5 w-3.5 border-zinc-600"
          />
          Untagged only
        </label>
        <Button
          size="sm"
          variant="outline"
          className="h-8 border-zinc-700 px-4 text-xs text-zinc-300 hover:border-zinc-500 hover:text-zinc-100"
          onClick={() => fetchTracks()}
          disabled={loading}
        >
          {loading ? "Searching…" : "Search"}
        </Button>
        {hasSearched && (
          <span className="ml-auto font-mono text-xs text-zinc-600">
            {tracks.length} result{tracks.length === 1 ? "" : "s"}
            {tracks.length === 200 && " · limit reached"}
          </span>
        )}
      </div>

      {fetchError && <p className="text-xs text-rose-400">{fetchError}</p>}
      {mutError && <p className="text-xs text-rose-400">{mutError}</p>}

      {/* Results */}
      {!hasSearched ? (
        <p className="py-10 text-center text-xs text-zinc-600">
          Search by track name, or select a game to browse its tracks.
        </p>
      ) : tracks.length === 0 ? (
        <p className="py-10 text-center text-xs text-zinc-600">
          No tracks match the current filters.
        </p>
      ) : (
        <>
          <div className="overflow-hidden rounded-lg border border-zinc-800">
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
                {tracks.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={11} className="py-8 text-center text-sm text-zinc-500">
                      No tracks match the current filters
                    </TableCell>
                  </TableRow>
                )}
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
        </>
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
