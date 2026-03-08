"use client";

import { useRef, useState } from "react";
import type { GameProgressEntry } from "@/hooks/usePlaylist";
import type { VibePreference } from "@/types";
import { VIBE_LABELS } from "@/types";
import {
  Spinner,
  CheckIcon,
  XIcon,
  ErrorCircle,
  MusicNote,
  ChevronDownIcon,
} from "@/components/Icons";

interface GenerateSectionProps {
  generating: boolean;
  genProgress: GameProgressEntry[];
  genGlobalMsg: string;
  genError: string | null;
  targetTrackCount: number;
  onTargetChange: (n: number) => void;
  onTargetSave: (n: number) => void;
  vibe: VibePreference;
  onVibeSave: (v: VibePreference) => Promise<void> | void;
  gamesCount: number;
  onGenerate: () => void;
}

const PRESETS = [25, 50, 100] as const;
const ALL_VIBES = Object.keys(VIBE_LABELS) as VibePreference[];

export function GenerateSection({
  generating,
  genProgress,
  genGlobalMsg,
  genError,
  targetTrackCount,
  onTargetChange,
  onTargetSave,
  vibe,
  onVibeSave,
  gamesCount,
  onGenerate,
}: GenerateSectionProps) {
  const isPresetValue = (PRESETS as readonly number[]).includes(targetTrackCount);
  const [customActive, setCustomActive] = useState(!isPresetValue);
  const [surpriseMeActive, setSurpriseMeActive] = useState(false);
  const customInputRef = useRef<HTMLInputElement>(null);

  function handlePresetClick(n: number) {
    setCustomActive(false);
    onTargetSave(n);
  }

  function handleCustomClick() {
    setCustomActive(true);
    // focus after state flush
    setTimeout(() => customInputRef.current?.select(), 0);
  }

  function handleVibeChange(value: string) {
    if (value === "surprise_me") {
      setSurpriseMeActive(true);
    } else {
      setSurpriseMeActive(false);
      onVibeSave(value as VibePreference);
    }
  }

  async function handleGenerate() {
    if (surpriseMeActive) {
      const randomVibe = ALL_VIBES[Math.floor(Math.random() * ALL_VIBES.length)];
      await onVibeSave(randomVibe);
      setSurpriseMeActive(false);
    }
    onGenerate();
  }

  const activePreset = customActive ? null : isPresetValue ? targetTrackCount : null;
  const vibeLabel = surpriseMeActive ? "surprise" : VIBE_LABELS[vibe];

  const summaryText =
    gamesCount === 0
      ? "Add games to your library to get started."
      : `${gamesCount} game${gamesCount !== 1 ? "s" : ""} · ${vibeLabel} vibe · ${targetTrackCount} tracks`;

  return (
    <div className="flex flex-col gap-2">
      {generating ? (
        <div className="flex flex-col gap-3 rounded-xl border border-teal-500/20 bg-zinc-900/70 p-4 shadow-lg shadow-black/30">
          <div className="flex items-center gap-2">
            <Spinner className="h-3 w-3 shrink-0 text-teal-400" />
            <span className="text-[11px] font-semibold tracking-widest text-teal-400 uppercase">
              Curating your vibe…
            </span>
          </div>

          <div className="flex flex-col gap-1.5">
            {genProgress.map((entry) => (
              <div key={entry.id} className="flex min-w-0 items-start gap-2">
                <div className="mt-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center">
                  {entry.status === "active" ? (
                    <Spinner className="h-3 w-3 text-teal-400" />
                  ) : entry.status === "done" ? (
                    <CheckIcon className="h-3 w-3 text-emerald-400" />
                  ) : entry.status === "error" ? (
                    <XIcon className="h-3 w-3 text-red-400" />
                  ) : (
                    <span className="block h-1.5 w-1.5 rounded-full bg-zinc-600" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <span
                    className={`truncate text-xs font-medium ${
                      entry.status === "active"
                        ? "text-white"
                        : entry.status === "done"
                          ? "text-zinc-400"
                          : entry.status === "error"
                            ? "text-red-400"
                            : "text-zinc-600"
                    }`}
                  >
                    {entry.title}
                  </span>
                  {entry.status !== "waiting" && entry.message && (
                    <span className="ml-1.5 text-[11px] text-zinc-500">{entry.message}</span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {genGlobalMsg && <p className="text-[11px] text-zinc-500 italic">{genGlobalMsg}</p>}
        </div>
      ) : (
        /* ── Control card ── */
        <div className="flex flex-col gap-5 rounded-2xl border border-white/[0.07] bg-zinc-900/70 p-4 shadow-lg shadow-black/40 backdrop-blur-sm">
          {/* Playlist Size */}
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-semibold tracking-widest text-zinc-500 uppercase">
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
              {/* Custom pill — becomes an input when active */}
              {customActive ? (
                <input
                  ref={customInputRef}
                  type="number"
                  min={1}
                  max={200}
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
                  className="flex-1 [appearance:textfield] bg-zinc-700 py-1.5 text-center text-xs font-medium text-white tabular-nums focus:ring-1 focus:ring-teal-500/50 focus:outline-none focus:ring-inset [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
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

          {/* Vibe */}
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-semibold tracking-widest text-zinc-500 uppercase">
              Vibe
            </span>
            <div className="relative">
              <select
                value={surpriseMeActive ? "surprise_me" : vibe}
                onChange={(e) => handleVibeChange(e.target.value)}
                className="w-full cursor-pointer appearance-none rounded-lg border border-white/[0.07] bg-zinc-950/60 py-1.5 pr-7 pl-2.5 text-xs text-white focus:border-teal-500/40 focus:ring-1 focus:ring-teal-500/50 focus:outline-none"
              >
                {(Object.entries(VIBE_LABELS) as [VibePreference, string][]).map(([v, label]) => (
                  <option key={v} value={v}>
                    {label}
                  </option>
                ))}
                <option value="surprise_me">✦ Surprise Me</option>
              </select>
              <ChevronDownIcon className="pointer-events-none absolute top-1/2 right-2 h-3 w-3 -translate-y-1/2 text-zinc-500" />
            </div>
          </div>

          {/* Action */}
          <div className="flex flex-col gap-2">
            <button
              onClick={handleGenerate}
              disabled={gamesCount === 0}
              className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-teal-600 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_0_20px_-4px] shadow-teal-500/30 transition-colors hover:bg-teal-500 active:bg-teal-700 disabled:cursor-not-allowed disabled:border disabled:border-white/[0.05] disabled:bg-zinc-800/80 disabled:text-zinc-500 disabled:shadow-none"
            >
              <MusicNote className="h-3.5 w-3.5" />
              Curate {targetTrackCount} Tracks
            </button>
            <p className="px-1 text-center text-[11px] leading-snug text-zinc-600">{summaryText}</p>
          </div>
        </div>
      )}

      {genError && (
        <div className="flex items-start gap-2 rounded-xl border border-red-500/20 bg-red-950/40 px-3 py-2.5 text-xs text-red-400">
          <ErrorCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {genError}
        </div>
      )}
    </div>
  );
}
