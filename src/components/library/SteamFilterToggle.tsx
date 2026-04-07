"use client";

import { ChevronDownIcon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatRelativeTime } from "@/lib/time";
import { SteamIcon } from "./SteamIcon";

interface SteamFilterToggleProps {
  active: boolean;
  onToggle: () => void;
  steamSyncedAt: string;
  onSync: () => Promise<boolean>;
  onDisconnect: () => Promise<boolean>;
  isSyncing: boolean;
  cooldownMinutes: number | null;
}

/**
 * Unified Steam pill: the left zone toggles the catalog filter, the right zone
 * (chevron) opens a popover for sync / disconnect. Both zones share a single
 * bordered pill that switches to amber when the filter is active.
 */
export function SteamFilterToggle({
  active,
  onToggle,
  steamSyncedAt,
  onSync,
  onDisconnect,
  isSyncing,
  cooldownMinutes,
}: SteamFilterToggleProps) {
  const syncDisabled = isSyncing || cooldownMinutes !== null;

  const borderClass = active
    ? "border-[var(--primary)] bg-[var(--primary)]/10"
    : "border-[var(--border-default)] bg-transparent";
  const textClass = active ? "text-[var(--primary)]" : "text-[var(--text-tertiary)]";
  const hoverClass = active ? "" : "hover:text-[var(--text-secondary)]";
  const dividerClass = active ? "bg-[var(--primary)]/40" : "bg-[var(--border-default)]";

  return (
    <div
      className={`inline-flex items-center rounded-full border transition-colors duration-100 ${borderClass}`}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={active}
        className={`flex cursor-pointer items-center gap-1.5 rounded-l-full py-1 pr-2 pl-3 text-[13px] transition-colors duration-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)] ${textClass} ${hoverClass}`}
      >
        <SteamIcon size={14} />
        My Steam games
      </button>
      <span aria-hidden="true" className={`h-4 w-px ${dividerClass}`} />
      <Popover>
        <PopoverTrigger
          render={
            <button
              type="button"
              aria-label="Manage Steam connection"
              className={`flex cursor-pointer items-center rounded-r-full py-1 pr-2 pl-1.5 transition-colors duration-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)] ${textClass} ${hoverClass}`}
            />
          }
        >
          <ChevronDownIcon size={14} />
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
    </div>
  );
}
