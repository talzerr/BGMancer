"use client";

import { useEffect, useRef, useState, type SyntheticEvent } from "react";
import { GameProgressStatus } from "@/types";
import type { GameProgressEntry } from "@/hooks/usePlaylist";
import { Spinner, CheckIcon, XIcon, ErrorCircle, MusicNote, PlayIcon } from "@/components/Icons";
import { MAX_TRACK_COUNT, COOLDOWN_QUIPS } from "@/lib/constants";

interface GenerateSectionProps {
  generating: boolean;
  genProgress: GameProgressEntry[];
  genGlobalMsg: string;
  genError: string | null;
  cooldownUntil: number;
  targetTrackCount: number;
  onTargetChange: (n: number) => void;
  onTargetSave: (n: number) => void;
  gamesCount: number;
  onGenerate: () => void;
  allowLongTracks: boolean;
  onToggleLongTracks: (enabled: boolean) => void;
  // Import-related props
  importUrl: string;
  onImportUrlChange: (url: string) => void;
  importing: boolean;
  importError: string | null;
  onImport: (e: SyntheticEvent<HTMLFormElement>) => void;
}

const PRESETS = [25, 50, 100] as const;

export function GenerateSection({
  generating,
  genProgress,
  genGlobalMsg,
  genError,
  cooldownUntil,
  targetTrackCount,
  onTargetChange,
  onTargetSave,
  gamesCount,
  onGenerate,
  allowLongTracks,
  onToggleLongTracks,
  importUrl,
  onImportUrlChange,
  importing,
  importError,
  onImport,
}: GenerateSectionProps) {
  const [mode, setMode] = useState<"generate" | "import">("generate");
  const isPresetValue = (PRESETS as readonly number[]).includes(targetTrackCount);
  const [customActive, setCustomActive] = useState(!isPresetValue);
  const customInputRef = useRef<HTMLInputElement>(null);
  const [secsLeft, setSecsLeft] = useState(0);
  const [quip, setQuip] = useState("");
  useEffect(() => {
    const update = () => setSecsLeft(Math.max(0, Math.ceil((cooldownUntil - Date.now()) / 1000)));
    // A zero-delay timeout fires in the next task (not synchronously in the effect body),
    // giving an immediate first tick without triggering the cascading-renders lint rule.
    // We also pick a new quip here so both updates happen in the same scheduled task.
    const timeout = setTimeout(() => {
      update();
      if (cooldownUntil > Date.now()) {
        setQuip(COOLDOWN_QUIPS[Math.floor(Math.random() * COOLDOWN_QUIPS.length)]);
      }
    }, 0);
    const interval = setInterval(update, 250);
    return () => {
      clearTimeout(timeout);
      clearInterval(interval);
    };
  }, [cooldownUntil]);

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

  const showGenerate = mode === "generate" && !generating;
  const showImport = mode === "import";

  return (
    <div className="flex flex-col gap-2">
      {/* Generate mode — progress */}
      {mode === "generate" && generating && (
        <div className="flex flex-col gap-3 rounded-xl border border-teal-500/20 bg-zinc-900/70 p-4 shadow-lg shadow-black/30">
          <div className="flex items-center gap-2">
            <Spinner className="h-3 w-3 shrink-0 text-teal-400" />
            <span className="text-[11px] font-semibold tracking-widest text-teal-400 uppercase">
              Curating your playlist…
            </span>
          </div>

          <div className="flex flex-col gap-1.5">
            {genProgress.map((entry) => (
              <div key={entry.id} className="flex min-w-0 items-start gap-2">
                <div className="mt-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center">
                  {entry.status === GameProgressStatus.Active ? (
                    <Spinner className="h-3 w-3 text-teal-400" />
                  ) : entry.status === GameProgressStatus.Done ? (
                    <CheckIcon className="h-3 w-3 text-emerald-400" />
                  ) : entry.status === GameProgressStatus.Error ? (
                    <XIcon className="h-3 w-3 text-red-400" />
                  ) : (
                    <span className="block h-1.5 w-1.5 rounded-full bg-zinc-600" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <span
                    className={`truncate text-xs font-medium ${
                      entry.status === GameProgressStatus.Active
                        ? "text-white"
                        : entry.status === GameProgressStatus.Done
                          ? "text-zinc-400"
                          : entry.status === GameProgressStatus.Error
                            ? "text-red-400"
                            : "text-zinc-600"
                    }`}
                  >
                    {entry.title}
                  </span>
                  {entry.status !== GameProgressStatus.Waiting && entry.message && (
                    <span className="ml-1.5 text-[11px] text-zinc-500">{entry.message}</span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {genGlobalMsg && <p className="text-[11px] text-zinc-500 italic">{genGlobalMsg}</p>}
        </div>
      )}

      {/* Animated card slot — both panels live here, no gap between them */}
      <div className="flex flex-col">
        {/* Generate mode — control card */}
        <div
          className={`grid transition-[grid-template-rows] duration-250 ease-in-out ${
            showGenerate ? "[grid-template-rows:1fr]" : "[grid-template-rows:0fr]"
          }`}
        >
          <div
            className={`overflow-hidden transition-opacity duration-200 ${
              showGenerate ? "opacity-100" : "opacity-0"
            }`}
          >
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

              {/* Options */}
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-semibold tracking-widest text-zinc-500 uppercase">
                  Options
                </span>
                <div className="flex flex-wrap gap-1.5">
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
                    {/* Tooltip */}
                    <div className="pointer-events-none absolute bottom-full left-0 z-10 mb-2 w-56 rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2 opacity-0 shadow-xl shadow-black/50 transition-opacity group-hover:opacity-100">
                      <p className="text-xs font-medium text-zinc-200">Allow long tracks</p>
                      <p className="mt-0.5 text-[11px] leading-snug text-zinc-400">
                        When off (default), tracks longer than 10 minutes are excluded. Useful for
                        keeping a playlist focused — OST medleys and extended suites are skipped.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action */}
              <div className="flex flex-col gap-2">
                <button
                  onClick={onGenerate}
                  disabled={gamesCount === 0 || secsLeft > 0}
                  className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-teal-600 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_0_20px_-4px] shadow-teal-500/30 transition-colors hover:bg-teal-500 active:bg-teal-700 disabled:cursor-not-allowed disabled:border disabled:border-white/[0.05] disabled:bg-zinc-800/80 disabled:text-zinc-500 disabled:shadow-none"
                >
                  <MusicNote className="h-3.5 w-3.5" />
                  {secsLeft > 0 ? (
                    <span className="text-xs font-normal opacity-60">{quip}</span>
                  ) : (
                    `Curate ${targetTrackCount} Tracks`
                  )}
                </button>
                <div className="flex items-center justify-between px-1">
                  <p className="text-[11px] leading-snug text-zinc-600">{summaryText}</p>
                  <button
                    onClick={() => setMode("import")}
                    className="shrink-0 text-[11px] text-zinc-600 transition-colors hover:text-zinc-400"
                  >
                    Import from YouTube →
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Import mode — compact secondary panel */}
        <div
          className={`grid transition-[grid-template-rows] duration-250 ease-in-out ${
            showImport ? "[grid-template-rows:1fr]" : "[grid-template-rows:0fr]"
          }`}
        >
          <div
            className={`overflow-hidden transition-opacity duration-200 ${
              showImport ? "opacity-100" : "opacity-0"
            }`}
          >
            <div className="flex flex-col gap-3 rounded-xl border border-white/[0.05] bg-zinc-900/50 p-3.5">
              <button
                onClick={() => setMode("generate")}
                className="flex items-center gap-1 self-start text-[11px] text-zinc-600 transition-colors hover:text-zinc-400"
              >
                ← Back to Curate
              </button>

              <form onSubmit={onImport} className="flex flex-col gap-2">
                <input
                  id="playlist-url"
                  type="text"
                  placeholder="YouTube playlist URL or ID…"
                  value={importUrl}
                  onChange={(e) => onImportUrlChange(e.target.value)}
                  disabled={importing}
                  className="rounded-lg border border-white/[0.07] bg-zinc-950/70 px-3 py-2 text-sm text-white placeholder-zinc-600 transition-colors focus:border-teal-500/40 focus:ring-1 focus:ring-teal-500/30 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={!importUrl.trim() || importing}
                  className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-white/[0.07] bg-zinc-800/80 px-4 py-2 text-xs font-medium text-zinc-400 transition-colors hover:border-red-500/30 hover:bg-red-950/50 hover:text-red-400 active:bg-red-950/70 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {importing ? (
                    <>
                      <Spinner className="h-3 w-3" />
                      Importing…
                    </>
                  ) : (
                    <>
                      <PlayIcon className="h-3 w-3" />
                      Import from YouTube
                    </>
                  )}
                </button>
              </form>
              {!importing && (
                <p className="text-[11px] text-zinc-600">
                  Imports all tracks — creates a new playlist in your history.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Error messages — hidden while a cooldown is active (button shows the countdown instead) */}
      {mode === "generate" && genError && secsLeft === 0 && (
        <div className="flex items-start gap-2 rounded-xl border border-red-500/20 bg-red-950/40 px-3 py-2.5 text-xs text-red-400">
          <ErrorCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {genError}
        </div>
      )}

      {mode === "import" && importError && (
        <div className="flex items-start gap-2 rounded-xl border border-red-500/20 bg-red-950/40 px-3 py-2.5 text-xs text-red-400">
          <ErrorCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {importError}
        </div>
      )}
    </div>
  );
}
