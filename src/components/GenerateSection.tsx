"use client";

import { useRef, useState } from "react";
import type { GameProgressEntry } from "@/hooks/usePlaylist";
import type { VibePreference } from "@/types";
import { VIBE_LABELS } from "@/types";
import { Spinner, CheckIcon, XIcon, ErrorCircle, MusicNote, ChevronDownIcon } from "@/components/Icons";

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

  const summaryText = gamesCount === 0
    ? "Add games to your library to get started."
    : `${gamesCount} game${gamesCount !== 1 ? "s" : ""} · ${vibeLabel} vibe · ${targetTrackCount} tracks`;

  return (
    <div className="flex flex-col gap-2">
      {generating ? (
        <div className="rounded-xl bg-zinc-900/70 border border-teal-500/20 p-4 flex flex-col gap-3 shadow-lg shadow-black/30">
          <div className="flex items-center gap-2">
            <Spinner className="w-3 h-3 text-teal-400 shrink-0" />
            <span className="text-[11px] font-semibold text-teal-400 uppercase tracking-widest">
              Curating your vibe…
            </span>
          </div>

          <div className="flex flex-col gap-1.5">
            {genProgress.map((entry) => (
              <div key={entry.id} className="flex items-start gap-2 min-w-0">
                <div className="shrink-0 w-3.5 h-3.5 mt-0.5 flex items-center justify-center">
                  {entry.status === "active" ? (
                    <Spinner className="w-3 h-3 text-teal-400" />
                  ) : entry.status === "done" ? (
                    <CheckIcon className="w-3 h-3 text-emerald-400" />
                  ) : entry.status === "error" ? (
                    <XIcon className="w-3 h-3 text-red-400" />
                  ) : (
                    <span className="w-1.5 h-1.5 rounded-full bg-zinc-600 block" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <span className={`text-xs font-medium truncate ${
                    entry.status === "active" ? "text-white" :
                    entry.status === "done"   ? "text-zinc-400" :
                    entry.status === "error"  ? "text-red-400" :
                    "text-zinc-600"
                  }`}>{entry.title}</span>
                  {entry.status !== "waiting" && entry.message && (
                    <span className="text-[11px] text-zinc-500 ml-1.5">{entry.message}</span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {genGlobalMsg && (
            <p className="text-[11px] text-zinc-500 italic">{genGlobalMsg}</p>
          )}
        </div>
      ) : (
        /* ── Control card ── */
        <div className="rounded-2xl bg-zinc-900/70 border border-white/[0.07] p-4 flex flex-col gap-5 backdrop-blur-sm shadow-lg shadow-black/40">

          {/* Playlist Size */}
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest">
              Playlist Size
            </span>
            <div className="flex rounded-lg overflow-hidden border border-white/[0.07] bg-zinc-950/60">
              {PRESETS.map((n) => (
                <button
                  key={n}
                  onClick={() => handlePresetClick(n)}
                  className={`flex-1 py-1.5 text-xs font-medium cursor-pointer transition-colors border-r border-white/[0.07] ${
                    activePreset === n
                      ? "bg-zinc-700 text-white"
                      : "text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.04]"
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
                  className="flex-1 py-1.5 text-xs font-medium text-white text-center tabular-nums bg-zinc-700 focus:outline-none focus:ring-1 focus:ring-inset focus:ring-teal-500/50 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                />
              ) : (
                <button
                  onClick={handleCustomClick}
                  className="flex-1 py-1.5 text-xs font-medium cursor-pointer transition-colors text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.04]"
                >
                  Custom
                </button>
              )}
            </div>
          </div>

          {/* Vibe */}
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest">
              Vibe
            </span>
            <div className="relative">
              <select
                value={surpriseMeActive ? "surprise_me" : vibe}
                onChange={(e) => handleVibeChange(e.target.value)}
                className="w-full rounded-lg bg-zinc-950/60 border border-white/[0.07] pl-2.5 pr-7 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-teal-500/50 focus:border-teal-500/40 appearance-none cursor-pointer"
              >
                {(Object.entries(VIBE_LABELS) as [VibePreference, string][]).map(([v, label]) => (
                  <option key={v} value={v}>{label}</option>
                ))}
                <option value="surprise_me">✦ Surprise Me</option>
              </select>
              <ChevronDownIcon className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-zinc-500 pointer-events-none" />
            </div>
          </div>

          {/* Action */}
          <div className="flex flex-col gap-2">
            <button
              onClick={handleGenerate}
              disabled={gamesCount === 0}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-teal-600 hover:bg-teal-500 active:bg-teal-700 disabled:bg-zinc-800/80 disabled:text-zinc-500 disabled:border disabled:border-white/[0.05] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_0_20px_-4px] shadow-teal-500/30 cursor-pointer disabled:cursor-not-allowed disabled:shadow-none transition-colors"
            >
              <MusicNote className="w-3.5 h-3.5" />
              Curate {targetTrackCount} Tracks
            </button>
            <p className="text-[11px] text-zinc-600 text-center leading-snug px-1">
              {summaryText}
            </p>
          </div>

        </div>
      )}

      {genError && (
        <div className="flex items-start gap-2 rounded-xl bg-red-950/40 border border-red-500/20 px-3 py-2.5 text-xs text-red-400">
          <ErrorCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          {genError}
        </div>
      )}
    </div>
  );
}
