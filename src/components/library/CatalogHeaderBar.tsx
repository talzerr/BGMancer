"use client";

import { SteamFilterToggle } from "./SteamFilterToggle";
import { SteamManagePopover } from "./SteamManagePopover";

interface CatalogHeaderBarProps {
  search: string;
  onSearchChange: (value: string) => void;
  isSignedIn: boolean;
  steamLinked: boolean;
  steamFilterOn: boolean;
  onSteamFilterToggle: () => void;
  onConnectSteamClick: () => void;
  steamSyncedAt: string | null;
  onSteamSync: () => Promise<boolean>;
  onSteamDisconnect: () => Promise<boolean>;
  steamIsSyncing: boolean;
  steamCooldownMinutes: number | null;
}

export function CatalogHeaderBar({
  search,
  onSearchChange,
  isSignedIn,
  steamLinked,
  steamFilterOn,
  onSteamFilterToggle,
  onConnectSteamClick,
  steamSyncedAt,
  onSteamSync,
  onSteamDisconnect,
  steamIsSyncing,
  steamCooldownMinutes,
}: CatalogHeaderBarProps) {
  return (
    <div className="border-border flex items-center gap-3 border-b px-1 pb-2">
      <input
        type="text"
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder="Filter games..."
        className="border-border bg-secondary/60 text-foreground w-[160px] rounded-md border px-2.5 py-1 text-xs placeholder-[var(--text-disabled)] outline-none focus:border-[var(--border-emphasis)]"
      />
      {isSignedIn && !steamLinked && (
        <button
          type="button"
          onClick={onConnectSteamClick}
          className="text-[13px] text-[var(--text-tertiary)] transition-colors duration-100 hover:text-[var(--text-secondary)]"
        >
          Connect Steam
        </button>
      )}
      {isSignedIn && steamLinked && steamSyncedAt && (
        <div className="flex items-center gap-2">
          <SteamFilterToggle active={steamFilterOn} onToggle={onSteamFilterToggle} />
          <SteamManagePopover
            steamSyncedAt={steamSyncedAt}
            onSync={onSteamSync}
            onDisconnect={onSteamDisconnect}
            isSyncing={steamIsSyncing}
            cooldownMinutes={steamCooldownMinutes}
          />
        </div>
      )}
    </div>
  );
}
