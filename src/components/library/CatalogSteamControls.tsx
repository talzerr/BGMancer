"use client";

import { useState } from "react";
import { SteamConnectDialog } from "./SteamConnectDialog";
import { SteamFilterToggle } from "./SteamFilterToggle";
import { SteamIcon } from "./SteamIcon";
import type { useSteamLibrary } from "@/hooks/library/useSteamLibrary";

interface CatalogSteamControlsProps {
  lib: ReturnType<typeof useSteamLibrary>;
  filterOn: boolean;
  onFilterToggle: () => void;
  /** Fires after a successful disconnect so the parent can clear dependent state. */
  onDisconnected?: () => void;
}

export function CatalogSteamControls({
  lib,
  filterOn,
  onFilterToggle,
  onDisconnected,
}: CatalogSteamControlsProps) {
  const [connectDialogOpen, setConnectDialogOpen] = useState(false);

  async function handleDisconnect(): Promise<boolean> {
    const ok = await lib.disconnect();
    if (ok) onDisconnected?.();
    return ok;
  }

  if (!lib.linked) {
    return (
      <>
        <button
          type="button"
          onClick={() => setConnectDialogOpen(true)}
          className="flex cursor-pointer items-center gap-1.5 text-[12px] text-[var(--text-tertiary)] transition-colors duration-100 hover:text-[var(--text-secondary)]"
        >
          <SteamIcon size={14} />
          Connect Steam
        </button>
        <SteamConnectDialog
          open={connectDialogOpen}
          onOpenChange={setConnectDialogOpen}
          onSync={lib.sync}
          isSyncing={lib.isSyncing}
          error={lib.error}
        />
      </>
    );
  }

  return (
    <SteamFilterToggle
      active={filterOn}
      onToggle={onFilterToggle}
      steamSyncedAt={lib.steamSyncedAt}
      onSync={lib.sync}
      onDisconnect={handleDisconnect}
      isSyncing={lib.isSyncing}
      cooldownMinutes={lib.cooldownMinutes}
    />
  );
}
