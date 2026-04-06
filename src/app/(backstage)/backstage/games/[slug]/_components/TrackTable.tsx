"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EnergyBadge } from "@/components/backstage/EnergyBadge";
import { TagBadgeList } from "@/components/backstage/TagBadgeList";
import { BackstageModal, DiscoveredStatus, OnboardingPhase, TrackFilter } from "@/types";
import type { Game, Track } from "@/types";
import type { GameDetailActions } from "../_hooks/useGameDetailActions";
import type { ActiveModal } from "../GameDetailClient";
import { SFX_DURATION_THRESHOLD_SECONDS } from "@/lib/constants";

interface VideoDetail {
  videoId: string;
  durationSeconds: number | null;
  viewCount: number | null;
}

export function TrackTable({
  game,
  tracks,
  videoMap,
  videoDetailMap,
  onSetActiveModal,
  onSetEditTrack,
  actions,
  selected,
  onSelectionChange,
}: {
  game: Game;
  tracks: Track[];
  videoMap: Record<string, string>;
  videoDetailMap: Record<string, VideoDetail>;
  onSetActiveModal: (modal: ActiveModal) => void;
  onSetEditTrack: (track: Track) => void;
  actions: GameDetailActions;
  selected: Set<string>;
  onSelectionChange: (next: Set<string>) => void;
}) {
  const phase = game.onboarding_phase;
  const [filter, setFilter] = useState(TrackFilter.All);

  const activeCount = tracks.filter((t) => t.active).length;
  const inactiveCount = tracks.length - activeCount;
  const untaggedCount = tracks.filter(
    (t) => t.energy === null && t.discovered !== DiscoveredStatus.Rejected,
  ).length;
  const unresolvedCount = tracks.filter(
    (t) => !videoMap[t.name] && t.discovered !== DiscoveredStatus.Rejected,
  ).length;
  const discoveredCount = tracks.filter((t) => t.discovered === DiscoveredStatus.Pending).length;

  const filteredTracks = tracks.filter((t) => {
    switch (filter) {
      case TrackFilter.Active:
        return t.active;
      case TrackFilter.Inactive:
        return !t.active;
      case TrackFilter.Untagged:
        return t.energy === null && t.discovered !== DiscoveredStatus.Rejected;
      case TrackFilter.Unresolved:
        return !videoMap[t.name] && t.discovered !== DiscoveredStatus.Rejected;
      case TrackFilter.Discovered:
        return t.discovered === DiscoveredStatus.Pending;
      default:
        return true;
    }
  });

  const allFilteredSelected =
    filteredTracks.length > 0 && filteredTracks.every((t) => selected.has(t.name));

  function handleFilterChange(next: TrackFilter) {
    setFilter(next);
    onSelectionChange(new Set());
  }

  function toggleAll() {
    if (allFilteredSelected) {
      onSelectionChange(new Set());
    } else {
      onSelectionChange(new Set(filteredTracks.map((t) => t.name)));
    }
  }

  function toggleOne(track: Track) {
    const next = new Set(selected);
    if (next.has(track.name)) {
      next.delete(track.name);
    } else {
      next.add(track.name);
    }
    onSelectionChange(next);
  }

  const tabs: [TrackFilter, string][] = [
    [TrackFilter.All, `All (${tracks.length})`],
    [TrackFilter.Active, `Active (${activeCount})`],
    [TrackFilter.Inactive, `Inactive (${inactiveCount})`],
  ];
  if (untaggedCount > 0) tabs.push([TrackFilter.Untagged, `Untagged (${untaggedCount})`]);
  if (unresolvedCount > 0) tabs.push([TrackFilter.Unresolved, `Unresolved (${unresolvedCount})`]);
  if (discoveredCount > 0) tabs.push([TrackFilter.Discovered, `Discovered (${discoveredCount})`]);

  return (
    <>
      {/* Zero-state ingestion cards — shown in Draft with no tracks */}
      {tracks.length === 0 && phase === OnboardingPhase.Draft && (
        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={() => onSetActiveModal(BackstageModal.LoadTracks)}
            className="group border-border bg-secondary/40 hover:border-primary/50 hover:bg-primary/5 rounded-lg border border-dashed px-6 py-8 text-left transition-colors"
          >
            <p className="text-foreground group-hover:text-primary text-sm font-medium">
              Fetch from Discogs
            </p>
            <p className="mt-1 text-xs text-[var(--text-tertiary)]">
              Auto-discover the tracklist by searching Discogs, or fetch a specific release/master
              ID from the tracklist source above.
            </p>
          </button>
          <button
            onClick={() => onSetActiveModal(BackstageModal.ImportTracks)}
            className="group border-border bg-secondary/40 hover:border-primary/50 hover:bg-primary/5 rounded-lg border border-dashed px-6 py-8 text-left transition-colors"
          >
            <p className="text-foreground group-hover:text-primary text-sm font-medium">
              Paste Tracks
            </p>
            <p className="mt-1 text-xs text-[var(--text-tertiary)]">
              Paste a tracklist from VGMdb, Wikipedia, or any source. One track per line — durations
              are detected automatically.
            </p>
          </button>
        </div>
      )}

      {/* Track list */}
      {tracks.length > 0 && (
        <div className="border-border overflow-hidden rounded-lg border">
          {/* Track header bar */}
          <div className="bg-secondary/40 flex items-center justify-between px-4 py-2">
            <div className="flex gap-1">
              {tabs.map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => handleFilterChange(key)}
                  className={`rounded px-1.5 py-0.5 text-[10px] transition-colors ${
                    filter === key
                      ? "text-foreground bg-[var(--surface-hover)]"
                      : "hover:text-foreground text-[var(--text-tertiary)]"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              {tracks.some((t) => t.discovered === DiscoveredStatus.Pending) && (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-6 border-emerald-600/40 px-2 text-[10px] text-emerald-400 hover:bg-emerald-500/10"
                    onClick={() =>
                      actions.reviewDiscovered(
                        tracks
                          .filter((t) => t.discovered === DiscoveredStatus.Pending)
                          .map((t) => t.name),
                        [],
                      )
                    }
                  >
                    Approve All (
                    {tracks.filter((t) => t.discovered === DiscoveredStatus.Pending).length})
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-6 border-rose-600/40 px-2 text-[10px] text-rose-400 hover:bg-rose-500/10"
                    onClick={() =>
                      actions.reviewDiscovered(
                        [],
                        tracks
                          .filter((t) => t.discovered === DiscoveredStatus.Pending)
                          .map((t) => t.name),
                      )
                    }
                  >
                    Reject All
                  </Button>
                </>
              )}
              {!game.published && (
                <Button
                  size="sm"
                  variant="outline"
                  className="border-border text-foreground hover:text-foreground h-6 px-2 text-[10px]"
                  onClick={() => onSetActiveModal(BackstageModal.ImportTracks)}
                >
                  + Tracks
                </Button>
              )}
            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="w-8 px-2">
                  <Checkbox
                    checked={allFilteredSelected && filteredTracks.length > 0}
                    onCheckedChange={toggleAll}
                    className="h-3.5 w-3.5 border-[var(--border-emphasis)]"
                  />
                </TableHead>
                <TableHead className="w-10 text-[11px] tracking-wider text-[var(--text-tertiary)] uppercase">
                  #
                </TableHead>
                <TableHead className="w-8 text-[11px] tracking-wider text-[var(--text-tertiary)] uppercase">
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
                <TableHead className="w-14 text-[11px] tracking-wider text-[var(--text-tertiary)] uppercase">
                  Vocals
                </TableHead>
                <TableHead className="w-8 text-[11px] tracking-wider text-[var(--text-tertiary)] uppercase" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTracks.map((track, i) => {
                const vid = videoMap[track.name];
                const detail = videoDetailMap[track.name];
                const isSfx =
                  detail?.durationSeconds != null &&
                  detail.durationSeconds < SFX_DURATION_THRESHOLD_SECONDS;
                const isSelected = selected.has(track.name);
                return (
                  <TableRow
                    key={track.name}
                    onClick={() => onSetEditTrack(track)}
                    className={`border-border/60 cursor-pointer ${isSelected ? "bg-primary/5" : "hover:bg-secondary/30"}`}
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
                    <TableCell className="py-2 font-mono text-[11px] text-[var(--text-tertiary)]">
                      {i + 1}
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
                    <TableCell className="py-2 text-sm">
                      <div className="flex items-center gap-2">
                        <span
                          className={
                            track.discovered === DiscoveredStatus.Rejected
                              ? "text-[var(--text-disabled)] line-through"
                              : "text-foreground"
                          }
                        >
                          {track.name}
                        </span>
                        {track.discovered === DiscoveredStatus.Pending && (
                          <>
                            <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] text-amber-400">
                              discovered
                            </span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                actions.reviewDiscovered([track.name], []);
                              }}
                              className="rounded px-1.5 py-0.5 text-[10px] text-emerald-500 transition-colors hover:bg-emerald-500/10"
                            >
                              approve
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                actions.reviewDiscovered([], [track.name]);
                              }}
                              className="rounded px-1.5 py-0.5 text-[10px] text-rose-500 transition-colors hover:bg-rose-500/10"
                            >
                              reject
                            </button>
                          </>
                        )}
                        {track.discovered === DiscoveredStatus.Rejected && (
                          <span className="bg-secondary rounded px-1.5 py-0.5 text-[10px] text-[var(--text-disabled)]">
                            rejected
                          </span>
                        )}
                        {track.discovered === DiscoveredStatus.Approved && !track.taggedAt && (
                          <span className="bg-primary/15 text-primary rounded px-1.5 py-0.5 text-[10px]">
                            approved
                          </span>
                        )}
                        {!vid && track.discovered !== DiscoveredStatus.Rejected && (
                          <span className="rounded bg-rose-500/15 px-1.5 py-0.5 text-[10px] text-rose-400">
                            no video
                          </span>
                        )}
                        {isSfx && (
                          <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] text-amber-400">
                            sfx
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="py-2">
                      <EnergyBadge energy={track.energy} />
                    </TableCell>
                    <TableCell className="py-2">
                      <TagBadgeList tags={track.roles} maxVisible={2} />
                    </TableCell>
                    <TableCell className="py-2">
                      <TagBadgeList tags={track.moods} maxVisible={2} />
                    </TableCell>
                    <TableCell className="py-2 text-center font-mono text-[11px] text-[var(--text-tertiary)]">
                      {track.hasVocals === null ? "—" : track.hasVocals ? "yes" : "no"}
                    </TableCell>
                    <TableCell className="py-2 text-center">
                      {vid && (
                        <a
                          href={`https://www.youtube.com/watch?v=${vid}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="hover:text-foreground text-[var(--text-disabled)] transition-colors"
                        >
                          ▶
                        </a>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
}
