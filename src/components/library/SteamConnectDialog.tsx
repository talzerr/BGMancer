"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SteamIcon } from "./SteamIcon";

interface SteamConnectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSync: (steamUrl: string) => Promise<boolean>;
  isSyncing: boolean;
  error: string | null;
}

export function SteamConnectDialog({
  open,
  onOpenChange,
  onSync,
  isSyncing,
  error,
}: SteamConnectDialogProps) {
  const [url, setUrl] = useState("");

  function handleOpenChange(next: boolean) {
    if (!next) setUrl("");
    onOpenChange(next);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim() || isSyncing) return;
    const success = await onSync(url.trim());
    if (success) handleOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <SteamIcon size={16} />
            Connect Steam
          </DialogTitle>
        </DialogHeader>
        <p className="text-[13px] text-[var(--text-secondary)]">
          Paste your Steam profile URL or custom ID
        </p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <Input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://steamcommunity.com/id/..."
            disabled={isSyncing}
            autoFocus
          />
          {error && <p className="text-destructive text-[13px]">{error}</p>}
          <div className="flex justify-end">
            <Button type="submit" disabled={isSyncing || !url.trim()}>
              {isSyncing ? "Syncing..." : "Sync"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
