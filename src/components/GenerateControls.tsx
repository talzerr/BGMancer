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
  skipLlm: boolean;
  onToggleSkipLlm: (enabled: boolean) => void;
  llmCapReached: boolean;
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
  skipLlm,
  onToggleSkipLlm,
  llmCapReached,
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
        <span className="font-display text-[11px] font-semibold tracking-widest text-zinc-400 uppercase">
          Playlist Size
        </span>
        <div className="flex overflow-hidden rounded-lg border border-white/[0.07] bg-zinc-950/60">
          {PRESETS.map((n) => (
            <button
              key={n}
              onClick={() => handlePresetClick(n)}
              className={`flex-1 cursor-pointer border-r border-white/[0.07] py-1.5 text-xs font-medium transition-colors ${
                activePreset === n
                  ? "bg-zinc-700 text-white"
                  : "text-zinc-500 hover:bg-white/[0.04] hover:text-zinc-200"
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
              className="flex-1 [appearance:textfield] bg-zinc-700 py-1.5 text-center text-xs font-medium text-white tabular-nums focus:ring-1 focus:ring-violet-500/50 focus:outline-none focus:ring-inset [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
          ) : (
            <button
              onClick={handleCustomClick}
              className="flex-1 cursor-pointer py-1.5 text-xs font-medium text-zinc-500 transition-colors hover:bg-white/[0.04] hover:text-zinc-200"
            >
              Custom
            </button>
          )}
        </div>
      </div>

      {/* Options (logged-in only) */}
      {isSignedIn && (
        <div className="flex flex-col gap-1">
          <span className="font-display text-[11px] font-semibold tracking-widest text-zinc-400 uppercase">
            Options
          </span>
          <div className="flex flex-wrap gap-1.5">
            {/* Express Mode toggle */}
            <div className="group relative">
              <button
                onClick={() => !llmCapReached && onToggleSkipLlm(!skipLlm)}
                disabled={llmCapReached}
                className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors ${
                  llmCapReached
                    ? "cursor-not-allowed border-zinc-700/40 bg-zinc-900/30 text-zinc-600"
                    : skipLlm
                      ? "cursor-pointer border-cyan-500/40 bg-cyan-900/30 text-cyan-300 hover:bg-cyan-900/50"
                      : "cursor-pointer border-white/[0.06] bg-zinc-950/60 text-zinc-500 hover:border-white/[0.12] hover:text-zinc-300"
                }`}
              >
                <span>
                  {llmCapReached
                    ? "🎯 Express: always on"
                    : skipLlm
                      ? "🎯 Express: on"
                      : "🎯 Express: off"}
                </span>
              </button>
              <div className="pointer-events-none absolute bottom-full left-0 z-10 mb-2 w-56 rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2 opacity-0 shadow-xl shadow-black/50 transition-opacity group-hover:opacity-100">
                <p className="text-xs font-medium text-zinc-200">
                  {llmCapReached ? "Daily AI limit reached" : "Express Mode"}
                </p>
                <p className="mt-0.5 text-[11px] leading-snug text-zinc-400">
                  {llmCapReached
                    ? "You've used all your AI-powered generations for today. Playlists are still curated, just without AI vibe scoring. Resets tomorrow."
                    : "When on, skips the AI Vibe Profiler for faster generation. Playlists are still curated by the Director engine, just without AI-tuned mood scoring."}
                </p>
              </div>
            </div>
            {/* Allow long tracks toggle */}
            <div className="group relative">
              <button
                onClick={() => onToggleLongTracks(!allowLongTracks)}
                className={`flex cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors ${
                  allowLongTracks
                    ? "border-orange-500/40 bg-orange-900/30 text-orange-300 hover:bg-orange-900/50"
                    : "border-white/[0.06] bg-zinc-950/60 text-zinc-500 hover:border-white/[0.12] hover:text-zinc-300"
                }`}
              >
                <span>{allowLongTracks ? "⏱ Long tracks: on" : "⏱ Long tracks: off"}</span>
              </button>
              <div className="pointer-events-none absolute bottom-full left-0 z-10 mb-2 w-56 rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2 opacity-0 shadow-xl shadow-black/50 transition-opacity group-hover:opacity-100">
                <p className="text-xs font-medium text-zinc-200">Allow long tracks</p>
                <p className="mt-0.5 text-[11px] leading-snug text-zinc-400">
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
                    ? "border-violet-500/40 bg-violet-900/30 text-violet-300 hover:bg-violet-900/50"
                    : "border-white/[0.06] bg-zinc-950/60 text-zinc-500 hover:border-white/[0.12] hover:text-zinc-300"
                }`}
              >
                <span>{allowShortTracks ? "⚡ Short tracks: on" : "⚡ Short tracks: off"}</span>
              </button>
              <div className="pointer-events-none absolute right-0 bottom-full z-10 mb-2 w-56 rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2 opacity-0 shadow-xl shadow-black/50 transition-opacity group-hover:opacity-100">
                <p className="text-xs font-medium text-zinc-200">Allow short tracks</p>
                <p className="mt-0.5 text-[11px] leading-snug text-zinc-400">
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
                    ? "border-purple-500/40 bg-purple-900/30 text-purple-300 hover:bg-purple-900/50"
                    : "border-white/[0.06] bg-zinc-950/60 text-zinc-500 hover:border-white/[0.12] hover:text-zinc-300"
                }`}
              >
                <span>{rawVibes ? "♫ Raw vibes: on" : "♫ Raw vibes: off"}</span>
              </button>
              <div className="pointer-events-none absolute right-0 bottom-full z-10 mb-2 w-56 rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2 opacity-0 shadow-xl shadow-black/50 transition-opacity group-hover:opacity-100">
                <p className="text-xs font-medium text-zinc-200">Raw vibes</p>
                <p className="mt-0.5 text-[11px] leading-snug text-zinc-400">
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
          className="cta-glow-pulse flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-violet-600 px-5 py-3.5 text-sm font-semibold text-white shadow-[0_0_24px_-4px] shadow-violet-500/40 transition-all duration-200 hover:scale-[1.02] hover:bg-violet-500 hover:shadow-[0_0_32px_-2px] hover:shadow-violet-500/50 active:scale-[0.97] active:bg-violet-700 active:shadow-[0_0_12px_-4px] active:shadow-violet-500/30 disabled:cursor-not-allowed disabled:border disabled:border-white/[0.05] disabled:bg-zinc-800/80 disabled:text-zinc-500 disabled:shadow-none disabled:hover:scale-100"
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
          <p className="text-[11px] leading-snug text-zinc-600">{summaryText}</p>
          <button
            onClick={onSwitchToImport}
            className={`shrink-0 text-[11px] text-zinc-600 transition-colors hover:text-zinc-400 ${gamesCount === 0 ? "self-end" : ""}`}
          >
            Import from YouTube →
          </button>
        </div>
      </div>
    </div>
  );
}
