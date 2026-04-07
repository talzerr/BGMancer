"use client";

import { useRef, useState } from "react";
import { MusicNote } from "@/components/Icons";
import { MAX_TRACK_COUNT } from "@/lib/constants";

const PRESETS = [25, 50, 100] as const;

interface GenerateControlsProps {
  targetTrackCount: number;
  onTargetChange: (n: number) => void;
  onTargetSave: (n: number) => void;
  gamesCount: number;
  onGenerate: () => void;
  allowLongTracks: boolean;
  onToggleLongTracks: (enabled: boolean) => void;
  allowShortTracks: boolean;
  onToggleShortTracks: (enabled: boolean) => void;
  rawVibes: boolean;
  onToggleRawVibes: (enabled: boolean) => void;
  isSignedIn: boolean;
  secsLeft: number;
  quip: string;
  onSwitchToImport: () => void;
}

export function GenerateControls({
  targetTrackCount,
  onTargetChange,
  onTargetSave,
  gamesCount,
  onGenerate,
  allowLongTracks,
  onToggleLongTracks,
  allowShortTracks,
  onToggleShortTracks,
  rawVibes,
  onToggleRawVibes,
  isSignedIn,
  secsLeft,
  quip,
  onSwitchToImport,
}: GenerateControlsProps) {
  const isPresetValue = (PRESETS as readonly number[]).includes(targetTrackCount);
  const [customActive, setCustomActive] = useState(!isPresetValue);
  const customInputRef = useRef<HTMLInputElement>(null);

  function handlePresetClick(n: number) {
    setCustomActive(false);
    onTargetSave(n);
  }

  function handleCustomClick() {
    setCustomActive(true);
    setTimeout(() => customInputRef.current?.select(), 0);
  }

  const activePreset = customActive ? null : isPresetValue ? targetTrackCount : null;

  const summaryText =
    gamesCount === 0
      ? "Add games to your library to get started."
      : `${gamesCount} game${gamesCount !== 1 ? "s" : ""} · ${targetTrackCount} tracks`;

  return (
    <div className="flex flex-col gap-5 px-1">
      {/* Playlist Size */}
      <div className="flex flex-col gap-1">
        <span className="font-display text-muted-foreground text-[11px] font-medium tracking-widest uppercase">
          Playlist Size
        </span>
        <div className="border-border bg-background/60 flex overflow-hidden rounded-lg border">
          {PRESETS.map((n) => (
            <button
              key={n}
              onClick={() => handlePresetClick(n)}
              className={`border-border flex-1 cursor-pointer border-r py-1.5 text-xs font-medium transition-colors ${
                activePreset === n
                  ? "text-foreground bg-[var(--surface-hover)]"
                  : "hover:text-foreground text-[var(--text-tertiary)] hover:bg-white/[0.04]"
              }`}
            >
              {n}
            </button>
          ))}
          {customActive ? (
            <input
              ref={customInputRef}
              type="number"
              min={1}
              max={MAX_TRACK_COUNT}
              value={targetTrackCount}
              autoFocus
              onChange={(e) => {
                const v = parseInt(e.target.value, 10);
                if (!isNaN(v) && v >= 1 && v <= 200) onTargetChange(v);
              }}
              onBlur={(e) => {
                const v = parseInt(e.target.value, 10);
                if (!isNaN(v) && v >= 1 && v <= 200) onTargetSave(v);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                if (e.key === "Escape") {
                  handlePresetClick(PRESETS[0]);
                }
              }}
              className="text-foreground focus:ring-ring/50 flex-1 [appearance:textfield] bg-[var(--surface-hover)] py-1.5 text-center text-xs font-medium tabular-nums focus:ring-1 focus:outline-none focus:ring-inset [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
          ) : (
            <button
              onClick={handleCustomClick}
              className="hover:text-foreground flex-1 cursor-pointer py-1.5 text-xs font-medium text-[var(--text-tertiary)] transition-colors hover:bg-white/[0.04]"
            >
              Custom
            </button>
          )}
        </div>
      </div>

      {/* Options (logged-in only) */}
      {isSignedIn && (
        <div className="flex flex-col gap-1">
          <span className="font-display text-muted-foreground text-[11px] font-medium tracking-widest uppercase">
            Options
          </span>
          <div className="flex flex-wrap gap-1.5">
            {/* Allow long tracks toggle */}
            <div className="group relative">
              <button
                onClick={() => onToggleLongTracks(!allowLongTracks)}
                className={`flex cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors ${
                  allowLongTracks
                    ? "border-primary/40 bg-primary/10 text-primary hover:bg-primary/15"
                    : "border-border bg-background/60 hover:text-foreground text-[var(--text-tertiary)] hover:border-[var(--border-emphasis)]"
                }`}
              >
                <span>{allowLongTracks ? "Long tracks: on" : "Long tracks: off"}</span>
              </button>
              <div className="bg-secondary pointer-events-none absolute bottom-full left-0 z-10 mb-2 w-56 rounded-lg border border-white/[0.08] px-3 py-2 opacity-0 transition-opacity group-hover:opacity-100">
                <p className="text-foreground text-xs font-medium">Allow long tracks</p>
                <p className="text-muted-foreground mt-0.5 text-[11px] leading-snug">
                  When off (default), tracks longer than 10 minutes are excluded. Useful for keeping
                  a playlist focused — OST medleys and extended suites are skipped.
                </p>
              </div>
            </div>
            {/* Allow short tracks toggle */}
            <div className="group relative">
              <button
                onClick={() => onToggleShortTracks(!allowShortTracks)}
                className={`flex cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors ${
                  allowShortTracks
                    ? "border-primary/40 bg-primary/10 text-primary hover:bg-primary/15"
                    : "border-border bg-background/60 hover:text-foreground text-[var(--text-tertiary)] hover:border-[var(--border-emphasis)]"
                }`}
              >
                <span>{allowShortTracks ? "Short tracks: on" : "Short tracks: off"}</span>
              </button>
              <div className="bg-secondary pointer-events-none absolute right-0 bottom-full z-10 mb-2 w-56 rounded-lg border border-white/[0.08] px-3 py-2 opacity-0 transition-opacity group-hover:opacity-100">
                <p className="text-foreground text-xs font-medium">Allow short tracks</p>
                <p className="text-muted-foreground mt-0.5 text-[11px] leading-snug">
                  When off (default), tracks under 90 seconds are excluded. Useful for keeping
                  things flowing — intros, stingers, and short jingles are skipped.
                </p>
              </div>
            </div>
            {/* Raw vibes toggle */}
            <div className="group relative">
              <button
                onClick={() => onToggleRawVibes(!rawVibes)}
                className={`flex cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors ${
                  rawVibes
                    ? "border-primary/40 bg-primary/10 text-primary hover:bg-primary/15"
                    : "border-border bg-background/60 hover:text-foreground text-[var(--text-tertiary)] hover:border-[var(--border-emphasis)]"
                }`}
              >
                <span>{rawVibes ? "Raw vibes: on" : "Raw vibes: off"}</span>
              </button>
              <div className="bg-secondary pointer-events-none absolute right-0 bottom-full z-10 mb-2 w-56 rounded-lg border border-white/[0.08] px-3 py-2 opacity-0 transition-opacity group-hover:opacity-100">
                <p className="text-foreground text-xs font-medium">Raw vibes</p>
                <p className="text-muted-foreground mt-0.5 text-[11px] leading-snug">
                  When on, ignores YouTube view counts — all tracks scored purely on musical tags.
                  May surface more obscure tracks.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Action */}
      <div className="flex flex-col gap-2">
        <button
          onClick={onGenerate}
          disabled={gamesCount === 0 || secsLeft > 0}
          className="bg-primary text-foreground disabled:bg-secondary/80 flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl px-5 py-3.5 text-sm font-medium transition-all duration-200 hover:bg-[var(--primary-hover)] active:scale-[0.98] active:bg-[var(--primary-muted)] disabled:cursor-not-allowed disabled:border disabled:border-white/[0.05] disabled:text-[var(--text-disabled)] disabled:hover:scale-100"
        >
          <MusicNote className="h-3.5 w-3.5" />
          {secsLeft > 0 ? (
            <span className="text-xs font-normal opacity-60">{quip}</span>
          ) : (
            `Curate ${targetTrackCount} Tracks`
          )}
        </button>
        <div
          className={`flex px-1 ${gamesCount === 0 ? "flex-col gap-1" : "items-center justify-between"}`}
        >
          <p className="text-[11px] leading-snug text-[var(--text-disabled)]">{summaryText}</p>
          <button
            onClick={onSwitchToImport}
            className={`hover:text-muted-foreground shrink-0 text-[11px] text-[var(--text-disabled)] transition-colors ${gamesCount === 0 ? "self-end" : ""}`}
          >
            Import from YouTube →
          </button>
        </div>
      </div>
    </div>
  );
}
