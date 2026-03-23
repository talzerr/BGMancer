"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/backstage/StatusBadge";
import { SSEProgress } from "@/components/backstage/SSEProgress";
import { EnergyBadge } from "@/components/backstage/EnergyBadge";
import { TagBadgeList } from "@/components/backstage/TagBadgeList";
import { TrackEditSheet } from "@/components/backstage/TrackEditSheet";
import type { PatchUpdates } from "@/components/backstage/TrackEditSheet";
import type { Game, Track } from "@/types";
import type { ReviewFlag } from "@/lib/db/repos/review-flags";

interface GameDetailClientProps {
  game: Game;
  tracks: Track[];
  reviewFlags: ReviewFlag[];
}

type ActiveModal = "retag" | "reingest" | "add-track" | null;

export function GameDetailClient({ game, tracks, reviewFlags }: GameDetailClientProps) {
  const router = useRouter();
  const [activeModal, setActiveModal] = useState<ActiveModal>(null);
  const [newTrackName, setNewTrackName] = useState("");
  const [reingestRunning, setReingestRunning] = useState(false);
  const [reingestTyped, setReingestTyped] = useState("");
  const [editTrack, setEditTrack] = useState<Track | null>(null);
  const [mutError, setMutError] = useState<string | null>(null);

  const trackCount = tracks.length;
  const activeCount = tracks.filter((t) => t.active).length;
  const taggedCount = tracks.filter((t) => t.taggedAt !== null).length;

  function closeReingest() {
    setActiveModal(null);
    setReingestRunning(false);
    setReingestTyped("");
  }

  async function addTrack() {
    if (!newTrackName.trim()) return;
    setMutError(null);
    try {
      const res = await fetch("/api/backstage/tracks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameId: game.id, name: newTrackName.trim() }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setNewTrackName("");
      setActiveModal(null);
      router.refresh();
    } catch (err) {
      console.error("[GameDetail] addTrack failed:", err);
      setMutError("Failed to add track. Please try again.");
    }
  }

  async function handleTrackSave(gameId: string, name: string, updates: PatchUpdates) {
    setMutError(null);
    try {
      const res = await fetch("/api/backstage/tracks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameId, name, updates }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      router.refresh();
    } catch (err) {
      console.error("[GameDetail] handleTrackSave failed:", err);
      setMutError("Failed to save track. Please try again.");
    }
  }

  return (
    <div className="space-y-4">
      {/* Game header */}
      <div className="flex flex-wrap items-start justify-between gap-4 rounded-lg border border-zinc-800 bg-zinc-900/60 px-4 py-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="font-sans text-xl font-semibold text-zinc-100">{game.title}</h1>
            <StatusBadge status={game.tagging_status} />
          </div>
          <div className="flex flex-wrap gap-4 font-mono text-[11px] text-zinc-500">
            <span>{trackCount} tracks</span>
            <span>{activeCount} active</span>
            <span>{taggedCount} tagged</span>
            {reviewFlags.length > 0 && (
              <span className="text-amber-400">{reviewFlags.length} review flags</span>
            )}
            {game.tracklist_source && <span>source: {game.tracklist_source}</span>}
          </div>
          {game.yt_playlist_id && (
            <a
              href={`https://www.youtube.com/playlist?list=${game.yt_playlist_id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="block pt-1 text-[11px] text-zinc-500 transition-colors hover:text-zinc-300"
            >
              YouTube OST ↗
            </a>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            className="h-7 border-zinc-700 text-xs text-zinc-300 hover:text-zinc-100"
            onClick={() => setActiveModal("add-track")}
          >
            + Add track
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-7 border-zinc-700 text-xs text-zinc-300 hover:text-zinc-100"
            onClick={() => setActiveModal("retag")}
          >
            Re-tag all
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-7 border-rose-700/50 text-xs text-rose-400 hover:border-rose-600/50 hover:text-rose-300"
            onClick={() => setActiveModal("reingest")}
          >
            Re-ingest
          </Button>
        </div>
      </div>

      {mutError && (
        <p className="rounded-lg border border-rose-800/30 bg-rose-900/10 px-4 py-2 text-xs text-rose-400">
          {mutError}
        </p>
      )}

      {/* Review flags */}
      {reviewFlags.length > 0 && (
        <div className="rounded-lg border border-amber-800/30 bg-amber-900/10 px-4 py-3">
          <p className="mb-2 text-[11px] font-semibold tracking-wider text-amber-500 uppercase">
            Review flags ({reviewFlags.length})
          </p>
          <div className="space-y-1">
            {reviewFlags.map((flag) => (
              <div key={flag.id} className="flex items-start gap-2 font-mono text-[11px]">
                <Badge
                  variant="outline"
                  className="border-amber-700/50 bg-amber-500/10 text-amber-400"
                >
                  {flag.reason}
                </Badge>
                {flag.detail && <span className="text-zinc-500">{flag.detail}</span>}
                <span className="ml-auto text-zinc-600">{flag.createdAt.slice(0, 10)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Track list */}
      {tracks.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-zinc-800">
          <Table>
            <TableHeader>
              <TableRow className="border-zinc-800 hover:bg-transparent">
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
              </TableRow>
            </TableHeader>
            <TableBody>
              {tracks.map((track) => (
                <TableRow
                  key={track.name}
                  onClick={() => setEditTrack(track)}
                  className="cursor-pointer border-zinc-800/60 hover:bg-zinc-800/30"
                >
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
                  <TableCell className="py-2 text-center font-mono text-[11px] text-zinc-500">
                    {track.hasVocals === null ? "—" : track.hasVocals ? "yes" : "no"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Re-tag modal */}
      <Dialog open={activeModal === "retag"} onOpenChange={(v) => !v && setActiveModal(null)}>
        <DialogContent className="border-zinc-800 bg-zinc-900">
          <DialogHeader>
            <DialogTitle className="text-zinc-100">Re-tag: {game.title}</DialogTitle>
            <DialogDescription className="text-zinc-400">
              Clears all LLM tags and re-runs the tagger. Track names are preserved.
            </DialogDescription>
          </DialogHeader>
          <SSEProgress
            url="/api/backstage/retag"
            body={{ gameId: game.id }}
            progressLabel={(e) =>
              `Tagging track ${e.current ?? 0}/${e.total ?? "?"}… ${e.trackName ?? ""}`
            }
            doneLabel={(e) => `Done — ${e.tagged} tagged, ${e.needsReview} need review`}
            onDone={() => router.refresh()}
            onClose={() => setActiveModal(null)}
          />
        </DialogContent>
      </Dialog>

      {/* Re-ingest dialog */}
      <Dialog open={activeModal === "reingest"} onOpenChange={(v) => !v && closeReingest()}>
        <DialogContent className="border-zinc-800 bg-zinc-900">
          <DialogHeader>
            <DialogTitle className="text-zinc-100">Re-ingest: {game.title}</DialogTitle>
            {!reingestRunning && (
              <DialogDescription className="text-zinc-400">
                This will delete all {trackCount} tracks and re-fetch from Discogs. This cannot be
                undone.
              </DialogDescription>
            )}
          </DialogHeader>
          {reingestRunning ? (
            <SSEProgress
              url="/api/backstage/reingest"
              body={{ gameId: game.id }}
              progressLabel={(e) => String(e.message ?? "Working…")}
              doneLabel={(e) => `Done — ${e.trackCount} tracks, ${e.tagged} tagged`}
              onDone={() => router.refresh()}
              onClose={closeReingest}
            />
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-zinc-400">
                Type <span className="font-mono text-zinc-200">{game.title}</span> to confirm
              </p>
              <Input
                value={reingestTyped}
                onChange={(e) => setReingestTyped(e.target.value)}
                placeholder={game.title}
                className="border-zinc-700 bg-zinc-800 font-mono text-zinc-100 placeholder:text-zinc-600"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && reingestTyped === game.title) setReingestRunning(true);
                }}
              />
              <DialogFooter>
                <Button variant="ghost" className="text-zinc-400" onClick={closeReingest}>
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  disabled={reingestTyped !== game.title}
                  onClick={() => setReingestRunning(true)}
                >
                  Re-ingest
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Add track modal */}
      <Dialog open={activeModal === "add-track"} onOpenChange={(v) => !v && setActiveModal(null)}>
        <DialogContent className="border-zinc-800 bg-zinc-900">
          <DialogHeader>
            <DialogTitle className="text-zinc-100">Add track</DialogTitle>
            <DialogDescription className="text-zinc-400">
              Manually add a track to {game.title}. It will be untagged until the next re-tag.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              placeholder="Track name…"
              value={newTrackName}
              onChange={(e) => setNewTrackName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addTrack()}
              className="border-zinc-700 bg-zinc-800 text-zinc-100 placeholder:text-zinc-600"
            />
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="text-zinc-400"
                onClick={() => setActiveModal(null)}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                className="bg-violet-600 text-white hover:bg-violet-700"
                onClick={addTrack}
                disabled={!newTrackName.trim()}
              >
                Add
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Track edit sheet */}
      {editTrack && (
        <TrackEditSheet
          key={editTrack.name}
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
