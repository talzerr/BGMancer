"use client";

import { Button } from "@/components/ui/button";
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
import { BackstageModal, DiscoveredStatus, OnboardingPhase } from "@/types";
import type { Game, Track } from "@/types";
import type { GameDetailActions } from "../_hooks/useGameDetailActions";
import type { ActiveModal } from "../game-detail-client";

export function TrackTable({
  game,
  tracks,
  videoMap,
  editingTracks,
  setEditingTracks,
  onSetActiveModal,
  onSetEditTrack,
  onSetPendingDeleteTrack,
  actions,
}: {
  game: Game;
  tracks: Track[];
  videoMap: Record<string, string>;
  editingTracks: boolean;
  setEditingTracks: (v: boolean | ((prev: boolean) => boolean)) => void;
  onSetActiveModal: (modal: ActiveModal) => void;
  onSetEditTrack: (track: Track) => void;
  onSetPendingDeleteTrack: (track: Track) => void;
  actions: GameDetailActions;
}) {
  const phase = game.onboarding_phase;

  return (
    <>
      {/* Zero-state ingestion cards — shown in Draft with no tracks */}
      {tracks.length === 0 && phase === OnboardingPhase.Draft && (
        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={() => onSetActiveModal(BackstageModal.LoadTracks)}
            className="group rounded-lg border border-dashed border-zinc-700 bg-zinc-900/40 px-6 py-8 text-left transition-colors hover:border-violet-600/50 hover:bg-violet-500/5"
          >
            <p className="text-sm font-medium text-zinc-200 group-hover:text-violet-300">
              Fetch from Discogs
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              Auto-discover the tracklist by searching Discogs, or fetch a specific release/master
              ID from the tracklist source above.
            </p>
          </button>
          <button
            onClick={() => onSetActiveModal(BackstageModal.ImportTracks)}
            className="group rounded-lg border border-dashed border-zinc-700 bg-zinc-900/40 px-6 py-8 text-left transition-colors hover:border-violet-600/50 hover:bg-violet-500/5"
          >
            <p className="text-sm font-medium text-zinc-200 group-hover:text-violet-300">
              Paste Tracks
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              Paste a tracklist from VGMdb, Wikipedia, or any source. One track per line — durations
              are detected automatically.
            </p>
          </button>
        </div>
      )}

      {/* Track list */}
      {(tracks.length > 0 || editingTracks) && (
        <div
          className={`overflow-hidden rounded-lg border ${editingTracks ? "border-violet-600/40" : "border-zinc-800"}`}
        >
          {/* Track header bar */}
          <div
            className={`flex items-center justify-between px-4 py-2 ${editingTracks ? "bg-violet-500/5" : "bg-zinc-900/40"}`}
          >
            <span className="text-[11px] font-semibold tracking-wider text-zinc-500 uppercase">
              Tracks ({tracks.length})
            </span>
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
              {editingTracks && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-6 border-zinc-700 px-2 text-[10px] text-zinc-300 hover:text-zinc-100"
                  onClick={() => onSetActiveModal(BackstageModal.AddTrack)}
                >
                  + Add
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                className={`h-6 px-2 text-[10px] ${editingTracks ? "border-violet-600/50 text-violet-400" : "border-zinc-700 text-zinc-400 hover:text-zinc-200"}`}
                onClick={() => setEditingTracks((v) => !v)}
              >
                {editingTracks ? "Done" : "Edit"}
              </Button>
            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow className="border-zinc-800 hover:bg-transparent">
                {editingTracks && (
                  <TableHead className="w-8 text-[11px] tracking-wider text-zinc-500 uppercase" />
                )}
                <TableHead className="w-10 text-[11px] tracking-wider text-zinc-500 uppercase">
                  #
                </TableHead>
                <TableHead className="w-8 text-[11px] tracking-wider text-zinc-500 uppercase">
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
                <TableHead className="w-14 text-[11px] tracking-wider text-zinc-500 uppercase">
                  Vocals
                </TableHead>
                <TableHead className="w-8 text-[11px] tracking-wider text-zinc-500 uppercase" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {tracks.map((track, i) => {
                const vid = videoMap[track.name];
                return (
                  <TableRow
                    key={track.name}
                    onClick={() => !editingTracks && onSetEditTrack(track)}
                    className={`border-zinc-800/60 hover:bg-zinc-800/30 ${editingTracks ? "" : "cursor-pointer"}`}
                  >
                    {editingTracks && (
                      <TableCell className="py-2 text-center">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onSetPendingDeleteTrack(track);
                          }}
                          className="text-zinc-600 transition-colors hover:text-rose-400"
                        >
                          ✕
                        </button>
                      </TableCell>
                    )}
                    <TableCell className="py-2 font-mono text-[11px] text-zinc-500">
                      {i + 1}
                    </TableCell>
                    <TableCell className="py-2 text-center">
                      {editingTracks ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            actions.toggleTrackActive(track);
                          }}
                          className={`transition-colors ${track.active ? "text-emerald-400 hover:text-zinc-600" : "text-zinc-600 hover:text-emerald-400"}`}
                        >
                          {track.active ? "●" : "○"}
                        </button>
                      ) : (
                        <span className={track.active ? "text-emerald-400" : "text-zinc-600"}>
                          {track.active ? "●" : "○"}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="py-2 text-sm">
                      <div className="flex items-center gap-2">
                        <span
                          className={
                            track.discovered === DiscoveredStatus.Rejected
                              ? "text-zinc-600 line-through"
                              : "text-zinc-200"
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
                          <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-600">
                            rejected
                          </span>
                        )}
                        {track.discovered === DiscoveredStatus.Approved && !track.taggedAt && (
                          <span className="rounded bg-violet-500/15 px-1.5 py-0.5 text-[10px] text-violet-400">
                            approved
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
                    <TableCell className="py-2 text-center font-mono text-[11px] text-zinc-500">
                      {track.hasVocals === null ? "—" : track.hasVocals ? "yes" : "no"}
                    </TableCell>
                    <TableCell className="py-2 text-center">
                      {vid && (
                        <a
                          href={`https://www.youtube.com/watch?v=${vid}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-zinc-600 transition-colors hover:text-zinc-300"
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
