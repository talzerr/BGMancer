"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { BackstageModal } from "@/types";
import type { Track } from "@/types";
import type { GameDetailActions } from "../_hooks/useGameDetailActions";
import type { ActiveModal } from "../game-detail-client";

interface GameDetailBulkBarProps {
  selectedTracks: Track[];
  videoMap: Record<string, string>;
  actions: GameDetailActions;
  onSetActiveModal: (modal: ActiveModal) => void;
  onClearSelection: () => void;
}

export function GameDetailBulkBar({
  selectedTracks,
  videoMap,
  actions,
  onSetActiveModal,
  onClearSelection,
}: GameDetailBulkBarProps) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  if (selectedTracks.length === 0) return null;

  const unresolvedCount = selectedTracks.filter((t) => !videoMap[t.name]).length;
  const untaggedCount = selectedTracks.filter((t) => t.taggedAt === null).length;
  const names = selectedTracks.map((t) => t.name);

  return (
    <>
      <div className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900/95 px-4 py-2.5 shadow-2xl backdrop-blur-sm">
        <span className="mr-1 text-xs text-zinc-400">
          <span className="font-semibold text-zinc-200">{selectedTracks.length}</span> selected
        </span>

        <div className="h-4 w-px bg-zinc-700" />

        <Button
          size="sm"
          variant="ghost"
          className="h-7 px-2 text-xs text-zinc-300 hover:text-zinc-100"
          onClick={() => {
            actions.bulkSetActive(names, true);
            onClearSelection();
          }}
        >
          Activate
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 px-2 text-xs text-zinc-300 hover:text-zinc-100"
          onClick={() => {
            actions.bulkSetActive(names, false);
            onClearSelection();
          }}
        >
          Deactivate
        </Button>

        <div className="h-4 w-px bg-zinc-700" />

        <Button
          size="sm"
          variant="ghost"
          className="h-7 px-2 text-xs text-violet-400 hover:bg-violet-500/10 hover:text-violet-300"
          onClick={() => onSetActiveModal(BackstageModal.ResolveSelected)}
          disabled={unresolvedCount === 0}
        >
          Resolve ({unresolvedCount})
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 px-2 text-xs text-violet-400 hover:bg-violet-500/10 hover:text-violet-300"
          onClick={() => onSetActiveModal(BackstageModal.TagSelected)}
          disabled={untaggedCount === 0}
        >
          Tag ({untaggedCount})
        </Button>

        <div className="h-4 w-px bg-zinc-700" />

        <Button
          size="sm"
          variant="ghost"
          className="h-7 px-2 text-xs text-rose-400 hover:bg-rose-500/10 hover:text-rose-300"
          onClick={() => setConfirmingDelete(true)}
        >
          Delete
        </Button>
      </div>

      <Dialog open={confirmingDelete} onOpenChange={(v) => !v && setConfirmingDelete(false)}>
        <DialogContent className="border-zinc-800 bg-zinc-900">
          <DialogHeader>
            <DialogTitle className="text-zinc-100">
              Delete {selectedTracks.length} tracks
            </DialogTitle>
            <DialogDescription className="text-zinc-400">
              Are you sure you want to delete {selectedTracks.length} track
              {selectedTracks.length === 1 ? "" : "s"}? This will also remove their video mappings.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="ghost"
              className="text-zinc-400"
              onClick={() => setConfirmingDelete(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                await actions.bulkDeleteTracks(names);
                setConfirmingDelete(false);
                onClearSelection();
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
