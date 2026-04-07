"use client";

import { ChevronDownIcon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { formatRelativeTime } from "@/lib/time";

interface SteamManagePopoverProps {
  steamSyncedAt: string;
  onSync: () => Promise<boolean>;
  onDisconnect: () => Promise<boolean>;
  isSyncing: boolean;
  cooldownMinutes: number | null;
}

export function SteamManagePopover({
  steamSyncedAt,
  onSync,
  onDisconnect,
  isSyncing,
  cooldownMinutes,
}: SteamManagePopoverProps) {
  const syncDisabled = isSyncing || cooldownMinutes !== null;

  return (
    <Popover>
      <PopoverTrigger
        render={<Button variant="ghost" size="icon-sm" aria-label="Manage Steam connection" />}
      >
        <ChevronDownIcon />
      </PopoverTrigger>
      <PopoverContent align="end">
        <div className="flex min-w-[200px] flex-col gap-2 p-3">
          <p className="text-[13px] text-[var(--text-tertiary)]">
            Last synced {formatRelativeTime(steamSyncedAt)}
          </p>
          <hr className="border-[var(--border-default)]" />
          <button
            type="button"
            onClick={() => {
              if (!syncDisabled) void onSync();
            }}
            disabled={syncDisabled}
            className={`text-left text-[13px] transition-colors duration-100 ${
              isSyncing
                ? "cursor-default text-[var(--text-disabled)]"
                : cooldownMinutes !== null
                  ? "cursor-default text-[var(--text-tertiary)]"
                  : "cursor-pointer text-[var(--text-primary)] hover:text-[var(--text-secondary)]"
            }`}
          >
            {isSyncing
              ? "Syncing..."
              : cooldownMinutes !== null
                ? `Synced recently. Try again in ${cooldownMinutes} minutes`
                : "Sync now"}
          </button>
          <button
            type="button"
            onClick={() => void onDisconnect()}
            className="text-destructive cursor-pointer text-left text-[13px] transition-colors duration-100"
          >
            Disconnect Steam
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
