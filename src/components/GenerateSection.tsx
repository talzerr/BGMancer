"use client";

import type { GameProgressEntry } from "@/hooks/usePlaylist";
import { Spinner, CheckIcon, XIcon, ErrorCircle, MusicNote } from "@/components/Icons";

interface GenerateSectionProps {
  generating: boolean;
  genProgress: GameProgressEntry[];
  genGlobalMsg: string;
  genError: string | null;
  targetTrackCount: number;
  onTargetChange: (n: number) => void;
  onTargetSave: (n: number) => void;
  gamesCount: number;
  onGenerate: () => void;
}

export function GenerateSection({
  generating,
  genProgress,
  genGlobalMsg,
  genError,
  targetTrackCount,
  onTargetChange,
  onTargetSave,
  gamesCount,
  onGenerate,
}: GenerateSectionProps) {
  return (
    <div className="flex flex-col gap-2">
      {generating ? (
        <div className="rounded-xl bg-zinc-900/70 border border-teal-500/20 p-3.5 flex flex-col gap-3 shadow-lg shadow-black/30">
          <div className="flex items-center gap-2">
            <Spinner className="w-3 h-3 text-teal-400 shrink-0" />
            <span className="text-[11px] font-semibold text-teal-400 uppercase tracking-widest">AI Generating</span>
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
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-zinc-500 shrink-0">Tracks</span>
            <div className="flex rounded-lg overflow-hidden border border-white/[0.07] bg-zinc-900/60">
              {[25, 50, 100].map((n) => (
                <button
                  key={n}
                  onClick={() => onTargetSave(n)}
                  className={`px-2.5 py-1.5 text-xs font-medium cursor-pointer transition-colors border-r border-white/[0.07] last:border-r-0 ${
                    targetTrackCount === n
                      ? "bg-zinc-700 text-white"
                      : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/60"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
            <input
              type="number"
              min={1}
              max={200}
              value={targetTrackCount}
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
              }}
              className="w-14 rounded-lg bg-zinc-900/60 border border-white/[0.07] px-2 py-1.5 text-xs text-white text-center tabular-nums focus:outline-none focus:ring-1 focus:ring-teal-500/50 focus:border-teal-500/40 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
          </div>

          <button
            onClick={onGenerate}
            disabled={gamesCount === 0}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-teal-600 hover:bg-teal-500 disabled:bg-zinc-800/80 disabled:text-zinc-500 disabled:border disabled:border-white/[0.05] px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-teal-900/40 cursor-pointer disabled:cursor-not-allowed"
          >
            <MusicNote className="w-3.5 h-3.5" />
            Generate {targetTrackCount} Tracks
          </button>
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
