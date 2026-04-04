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
import { BackstageModal, DiscoveredStatus } from "@/types";
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

  const eligible = selectedTracks.filter((t) => t.discovered !== DiscoveredStatus.Rejected);
  const unresolvedCount = eligible.filter((t) => !videoMap[t.name]).length;
  const taggableCount = eligible.filter((t) => videoMap[t.name]).length;
  const hasRejected = selectedTracks.length !== eligible.length;
  const names = selectedTracks.map((t) => t.name);
  const eligibleNames = eligible.map((t) => t.name);

  return (
    <>
      <div className="border-border bg-secondary/95 fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-xl border px-4 py-2.5 shadow-2xl backdrop-blur-sm">
        <span className="text-muted-foreground mr-1 text-xs">
          <span className="text-foreground font-medium">{selectedTracks.length}</span> selected
        </span>
        <button
          onClick={onClearSelection}
          className="hover:text-foreground ml-0.5 text-[var(--text-disabled)] transition-colors"
          aria-label="Clear selection"
        >
          ✕
        </button>

        <div className="bg-border h-4 w-px" />

        <Button
          size="sm"
          variant="ghost"
          className="text-foreground hover:text-foreground h-7 px-2 text-xs"
          onClick={() => {
            actions.bulkSetActive(eligibleNames, true);
            onClearSelection();
          }}
          disabled={hasRejected && eligible.length === 0}
        >
          Activate
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="text-foreground hover:text-foreground h-7 px-2 text-xs"
          onClick={() => {
            actions.bulkSetActive(names, false);
            onClearSelection();
          }}
        >
          Deactivate
        </Button>

        <div className="bg-border h-4 w-px" />

        <Button
          size="sm"
          variant="ghost"
          className="text-primary hover:bg-primary/10 hover:text-primary h-7 px-2 text-xs"
          onClick={() => onSetActiveModal(BackstageModal.ResolveSelected)}
          disabled={unresolvedCount === 0}
        >
          Resolve ({unresolvedCount})
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="text-primary hover:bg-primary/10 hover:text-primary h-7 px-2 text-xs"
          onClick={() => onSetActiveModal(BackstageModal.TagSelected)}
          disabled={taggableCount === 0}
        >
          Tag ({taggableCount})
        </Button>

        <div className="bg-border h-4 w-px" />

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
        <DialogContent className="border-border bg-secondary">
          <DialogHeader>
            <DialogTitle className="text-foreground">
              Delete {selectedTracks.length} tracks
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Are you sure you want to delete {selectedTracks.length} track
              {selectedTracks.length === 1 ? "" : "s"}? This will also remove their video mappings.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="ghost"
              className="text-muted-foreground"
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
