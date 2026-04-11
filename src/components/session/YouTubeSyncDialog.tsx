"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { SyncStatus } from "@/hooks/player/useSync";

interface YouTubeSyncDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  status: SyncStatus;
  error: string | null;
  onConfirm: () => void | Promise<void>;
}

/**
 * Confirmation dialog for sync-to-YouTube.
 *
 * The dialog itself never closes on success — the parent (`PlaylistHeader`)
 * watches the status transition to "synced" and flips `open` to false. This
 * avoids coupling the dialog to the hook's state machine and keeps the
 * "success" signal in one place: the hook.
 */
export function YouTubeSyncDialog({
  open,
  onOpenChange,
  status,
  error,
  onConfirm,
}: YouTubeSyncDialogProps) {
  const isSyncing = status === "syncing";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Sync to YouTube</DialogTitle>
        </DialogHeader>
        <p className="text-[13px] text-[var(--text-secondary)]">
          This will create a YouTube playlist with your current tracks. BGMancer needs permission to
          manage your YouTube playlists.
        </p>
        {error && <p className="text-destructive text-[13px]">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" disabled={isSyncing} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={isSyncing} onClick={() => void onConfirm()}>
            {isSyncing ? "Syncing…" : "Sync to YouTube"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
