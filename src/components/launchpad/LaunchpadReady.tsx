"use client";

import { useState } from "react";
import Link from "next/link";
import { GenerateProgressLine } from "@/components/generate/GenerateProgressLine";
import { ModeSelector } from "@/components/generate/ModeSelector";
import { ToggleRow } from "@/components/generate/ToggleRow";
import type { Game, PlaylistMode } from "@/types";
import { CoverRow } from "./CoverRow";
import { CustomSizeRow } from "./CustomSizeRow";

const PRESETS = [25, 50, 100] as const;

interface LaunchpadReadyProps {
  games: Game[];
  targetTrackCount: number;
  allowLongTracks: boolean;
  allowShortTracks: boolean;
  playlistMode: PlaylistMode;
  onSaveTrackCount: (n: number) => void;
  onToggleLongTracks: (enabled: boolean) => void;
  onToggleShortTracks: (enabled: boolean) => void;
  onPlaylistModeChange: (mode: PlaylistMode) => void;
  pressedCurate: boolean;
  onCurateClick: () => void;
  secsLeft: number;
  generating: boolean;
  genError: string | null;
  emptyModeMessage: string | null;
}

export function LaunchpadReady({
  games,
  targetTrackCount,
  allowLongTracks,
  allowShortTracks,
  playlistMode,
  onSaveTrackCount,
  onToggleLongTracks,
  onToggleShortTracks,
  onPlaylistModeChange,
  pressedCurate,
  onCurateClick,
  secsLeft,
  generating,
  genError,
  emptyModeMessage,
}: LaunchpadReadyProps) {
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const isCurating = pressedCurate || generating;
  const buttonDisabled = isCurating || secsLeft > 0;

  const optionClass = (active: boolean) =>
    `cursor-pointer transition-colors ${
      active
        ? "text-primary font-medium underline decoration-primary/40 underline-offset-4"
        : "text-[var(--text-disabled)] hover:text-[var(--text-tertiary)]"
    }`;

  return (
    <div className="relative flex max-w-[480px] flex-col items-center text-center">
      <CoverRow games={games} />

      <p className="mt-6 text-[13px] text-[var(--text-tertiary)]">
        {games.length} game{games.length !== 1 ? "s" : ""}
      </p>

      <div className="relative mt-1 flex h-[20px] w-full items-center justify-center">
        <Link
          href="/catalog"
          aria-hidden={isCurating}
          tabIndex={isCurating ? -1 : 0}
          className={`absolute text-[12px] text-[var(--text-disabled)] transition-opacity duration-200 hover:text-[var(--text-tertiary)] ${
            isCurating ? "pointer-events-none opacity-0" : "opacity-100"
          }`}
        >
          Add games →
        </Link>
        <div
          aria-hidden={!isCurating}
          className={`absolute transition-opacity duration-200 ${
            isCurating ? "opacity-100" : "pointer-events-none opacity-0"
          }`}
        >
          {isCurating && <GenerateProgressLine games={games} />}
        </div>
      </div>

      <button
        type="button"
        onClick={onCurateClick}
        disabled={buttonDisabled}
        className="bg-primary text-foreground mt-7 cursor-pointer rounded-xl px-10 py-3.5 text-[15px] font-medium transition-all hover:bg-[var(--primary-hover)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isCurating ? "Curating…" : `Curate ${targetTrackCount} Tracks`}
      </button>

      <div
        aria-hidden={isCurating}
        className={`mt-5 flex items-center gap-4 text-[12px] transition-opacity duration-200 ${
          isCurating ? "pointer-events-none opacity-0" : "opacity-100"
        }`}
      >
        <div className="flex items-center gap-3">
          {PRESETS.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => onSaveTrackCount(n)}
              className={`tabular-nums ${optionClass(targetTrackCount === n)}`}
            >
              {n}
            </button>
          ))}
        </div>

        <span className="text-[var(--text-disabled)]">|</span>

        <button
          type="button"
          onClick={() => setAdvancedOpen((open) => !open)}
          className={optionClass(advancedOpen)}
        >
          Advanced
        </button>
      </div>

      {/* Absolute so opening Advanced does not reflow the centered cluster. */}
      <div
        aria-hidden={!advancedOpen || isCurating}
        className={`absolute top-full left-1/2 mt-5 w-[300px] -translate-x-1/2 transition-opacity duration-[180ms] ease-out ${
          advancedOpen && !isCurating ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        <div className="flex flex-col gap-4 border-t border-[var(--border-default)] pt-4 text-left">
          <ModeSelector mode={playlistMode} onModeChange={onPlaylistModeChange} />
          <div className="border-border border-t" />
          <div className="flex flex-col gap-3">
            <CustomSizeRow
              value={targetTrackCount}
              onChange={onSaveTrackCount}
              isCustom={!(PRESETS as readonly number[]).includes(targetTrackCount)}
            />
            <ToggleRow
              variant="dim"
              label="Long tracks"
              description="Allow tracks over 9 min"
              on={allowLongTracks}
              onToggle={() => onToggleLongTracks(!allowLongTracks)}
            />
            <ToggleRow
              variant="dim"
              label="Short tracks"
              description="Allow tracks under 90s"
              on={allowShortTracks}
              onToggle={() => onToggleShortTracks(!allowShortTracks)}
            />
          </div>
        </div>
      </div>

      {genError && secsLeft === 0 && (
        <p className="text-destructive mt-3 text-[12px]">{genError}</p>
      )}

      {emptyModeMessage && !genError && (
        <p className="text-destructive mt-3 text-[13px]">{emptyModeMessage}</p>
      )}
    </div>
  );
}
