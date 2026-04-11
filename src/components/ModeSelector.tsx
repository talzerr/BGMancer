"use client";

import type { PlaylistMode } from "@/types";
import { PLAYLIST_MODE_LABELS, PLAYLIST_MODE_ORDER } from "@/lib/playlist-mode-labels";

interface ModeSelectorProps {
  mode: PlaylistMode;
  onModeChange: (mode: PlaylistMode) => void;
}

export function ModeSelector({ mode, onModeChange }: ModeSelectorProps) {
  const active = PLAYLIST_MODE_LABELS[mode];
  const inactive = PLAYLIST_MODE_ORDER.filter((m) => m !== mode);

  return (
    <div className="flex flex-col gap-2 px-1">
      <span className="text-muted-foreground text-[11px] font-medium tracking-widest uppercase">
        Mode
      </span>

      <div className="flex flex-col gap-0.5">
        <span className="text-primary text-[15px] font-medium">{active.name}</span>
        {/* All descriptions stacked in a single grid cell so the row always
            sizes to the tallest description and switching modes never reflows. */}
        <div className="grid">
          {PLAYLIST_MODE_ORDER.map((m) => (
            <span
              key={m}
              aria-hidden={m !== mode}
              className={`col-start-1 row-start-1 text-[11px] text-[var(--text-quaternary)] ${
                m === mode ? "" : "invisible"
              }`}
            >
              {PLAYLIST_MODE_LABELS[m].description}
            </span>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-[12px]">
        {inactive.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => onModeChange(m)}
            className="cursor-pointer text-[var(--text-disabled)] transition-colors hover:text-[var(--text-tertiary)]"
          >
            {PLAYLIST_MODE_LABELS[m].name}
          </button>
        ))}
      </div>
    </div>
  );
}
