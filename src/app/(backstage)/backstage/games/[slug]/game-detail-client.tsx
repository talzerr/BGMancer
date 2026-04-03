"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TrackEditSheet } from "@/components/backstage/TrackEditSheet";
import { ConfirmModal } from "@/components/backstage/ConfirmModal";
import { BackstageModal } from "@/types";
import type { Game, Track } from "@/types";
import type { ReviewFlag } from "@/lib/db/repos/review-flags";
import { useGameDetailActions } from "./_hooks/useGameDetailActions";
import { GameHeader } from "./_components/GameHeader";
import { MetadataEditor } from "./_components/MetadataEditor";
import { ReviewFlagsPanel } from "./_components/ReviewFlagsPanel";
import { TrackTable } from "./_components/TrackTable";
import { GameModals } from "./_components/GameModals";
import { GameDetailBulkBar } from "./_components/GameDetailBulkBar";

interface VideoDetail {
  videoId: string;
  durationSeconds: number | null;
  viewCount: number | null;
}

interface GameDetailClientProps {
  game: Game;
  tracks: Track[];
  reviewFlags: ReviewFlag[];
  videoMap: Record<string, string>;
  videoDetailMap: Record<string, VideoDetail>;
}

export type ActiveModal = BackstageModal | null;

export function GameDetailClient({
  game,
  tracks,
  reviewFlags,
  videoMap,
  videoDetailMap,
}: GameDetailClientProps) {
  const router = useRouter();
  const actions = useGameDetailActions(game, router);
  const [activeModal, setActiveModal] = useState<ActiveModal>(null);
  const [editTrack, setEditTrack] = useState<Track | null>(null);
  const [editingTracks, setEditingTracks] = useState(false);
  const [pendingDeleteTrack, setPendingDeleteTrack] = useState<Track | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const flagsRef = useRef<HTMLDetailsElement>(null);

  const clearSelection = () => setSelected(new Set());

  // SSE modals set sseRunning when they open, clear on close
  const SSE_MODALS: ActiveModal[] = [
    BackstageModal.LoadTracks,
    BackstageModal.Resolve,
    BackstageModal.QuickOnboard,
    BackstageModal.Retag,
    BackstageModal.ResolveSelected,
    BackstageModal.TagSelected,
  ];
  useEffect(() => {
    if (activeModal && SSE_MODALS.includes(activeModal)) {
      actions.setSseRunning(true);
    }
  }, [activeModal]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-4">
      <GameHeader
        game={game}
        tracks={tracks}
        videoMap={videoMap}
        reviewFlags={reviewFlags}
        actions={actions}
        onSetActiveModal={setActiveModal}
        flagsRef={flagsRef}
      />

      {actions.mutError && (
        <p className="rounded-lg border border-rose-800/30 bg-rose-900/10 px-4 py-2 text-xs text-rose-400">
          {actions.mutError}
        </p>
      )}

      <MetadataEditor game={game} onSaveField={actions.saveField} />

      <ReviewFlagsPanel reviewFlags={reviewFlags} actions={actions} flagsRef={flagsRef} />

      <TrackTable
        game={game}
        tracks={tracks}
        videoMap={videoMap}
        videoDetailMap={videoDetailMap}
        editingTracks={editingTracks}
        setEditingTracks={setEditingTracks}
        onSetActiveModal={setActiveModal}
        onSetEditTrack={setEditTrack}
        onSetPendingDeleteTrack={setPendingDeleteTrack}
        actions={actions}
        selected={selected}
        onSelectionChange={setSelected}
      />

      {/* Delete track confirmation */}
      <Dialog open={!!pendingDeleteTrack} onOpenChange={(v) => !v && setPendingDeleteTrack(null)}>
        <DialogContent className="border-zinc-800 bg-zinc-900">
          <DialogHeader>
            <DialogTitle className="text-zinc-100">Delete track</DialogTitle>
            <DialogDescription className="text-zinc-400">
              Are you sure you want to delete{" "}
              <span className="font-mono text-zinc-200">{pendingDeleteTrack?.name}</span>? This will
              also remove its video mapping.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="ghost"
              className="text-zinc-400"
              onClick={() => setPendingDeleteTrack(null)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                if (pendingDeleteTrack) await actions.deleteTrack(pendingDeleteTrack);
                setPendingDeleteTrack(null);
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <GameModals
        game={game}
        activeModal={activeModal}
        setActiveModal={setActiveModal}
        actions={actions}
        tracks={tracks}
        videoMap={videoMap}
        selected={selected}
        onSseDone={clearSelection}
      />

      <GameDetailBulkBar
        selectedTracks={tracks.filter((t) => selected.has(t.name))}
        videoMap={videoMap}
        actions={actions}
        onSetActiveModal={setActiveModal}
        onClearSelection={clearSelection}
      />

      {/* Track edit sheet */}
      {editTrack && (
        <TrackEditSheet
          key={editTrack.name}
          track={editTrack}
          videoMeta={videoDetailMap[editTrack.name] ?? null}
          open={!!editTrack}
          onOpenChange={(open) => {
            if (!open) setEditTrack(null);
          }}
          onSave={actions.handleTrackSave}
        />
      )}

      {/* Nuke game confirmation */}
      <ConfirmModal
        open={activeModal === BackstageModal.Nuke}
        onOpenChange={(v) => !v && setActiveModal(null)}
        title={`Delete ${game.title}?`}
        description="This will permanently delete this game and all its tracks, video mappings, review flags, and playlist references. It will also be removed from all user libraries. This cannot be undone."
        confirmLabel={actions.nuking ? "Deleting…" : "Delete"}
        typeToConfirm={game.title}
        destructive
        onConfirm={actions.deleteGame}
      />
    </div>
  );
}
