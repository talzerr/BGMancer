"use client";

import { ErrorCircle, MusicNote } from "@/components/Icons";
import { useCooldownTimer } from "@/hooks/shared/useCooldownTimer";
import { GenerateControls } from "@/components/GenerateControls";
import { GenerateProgressLine } from "@/components/GenerateProgressLine";

interface GenerateSectionProps {
  generating: boolean;
  genError: string | null;
  cooldownUntil: number;
  targetTrackCount: number;
  onTargetSave: (n: number) => void;
  gamesCount: number;
  games: { id: string; title: string }[];
  onGenerate: () => void;
  allowLongTracks: boolean;
  onToggleLongTracks: (enabled: boolean) => void;
  allowShortTracks: boolean;
  onToggleShortTracks: (enabled: boolean) => void;
}

export function GenerateSection({
  generating,
  genError,
  cooldownUntil,
  targetTrackCount,
  onTargetSave,
  gamesCount,
  games,
  onGenerate,
  allowLongTracks,
  onToggleLongTracks,
  allowShortTracks,
  onToggleShortTracks,
}: GenerateSectionProps) {
  const { secsLeft, quip } = useCooldownTimer(cooldownUntil);

  return (
    <div className="flex flex-col gap-3">
      {/* Action — sits directly below the library card so the primary
          action is reachable without scrolling past settings. */}
      <div className="px-1">
        <button
          onClick={onGenerate}
          disabled={gamesCount === 0 || secsLeft > 0 || generating}
          className="bg-primary text-foreground disabled:bg-secondary/80 flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-medium transition-all duration-200 hover:bg-[var(--primary-hover)] active:scale-[0.98] active:bg-[var(--primary-muted)] disabled:cursor-not-allowed disabled:border disabled:border-white/[0.05] disabled:text-[var(--text-disabled)] disabled:hover:scale-100"
        >
          <MusicNote className="h-3.5 w-3.5" />
          {secsLeft > 0 ? (
            <span className="text-xs font-normal opacity-60">{quip}</span>
          ) : generating ? (
            "Curating…"
          ) : (
            `Curate ${targetTrackCount} Tracks`
          )}
        </button>

        {generating && (
          <div className="mt-3">
            <GenerateProgressLine games={games} />
          </div>
        )}

        {genError && secsLeft === 0 && (
          <div className="mt-2 flex items-start gap-2 rounded-xl border border-red-500/20 bg-red-950/40 px-3 py-2.5 text-xs text-red-400">
            <ErrorCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {genError}
          </div>
        )}
      </div>

      <GenerateControls
        targetTrackCount={targetTrackCount}
        onTargetSave={onTargetSave}
        allowLongTracks={allowLongTracks}
        onToggleLongTracks={onToggleLongTracks}
        allowShortTracks={allowShortTracks}
        onToggleShortTracks={onToggleShortTracks}
      />
    </div>
  );
}
