"use client";

import { ErrorCircle } from "@/components/Icons";
import { useCooldownTimer } from "@/hooks/shared/useCooldownTimer";
import { GenerateControls } from "@/components/GenerateControls";
import { GenerateProgressLine } from "@/components/GenerateProgressLine";

interface GenerateSectionProps {
  generating: boolean;
  genError: string | null;
  cooldownUntil: number;
  targetTrackCount: number;
  onTargetChange: (n: number) => void;
  onTargetSave: (n: number) => void;
  gamesCount: number;
  games: { id: string; title: string }[];
  onGenerate: () => void;
  allowLongTracks: boolean;
  onToggleLongTracks: (enabled: boolean) => void;
  allowShortTracks: boolean;
  onToggleShortTracks: (enabled: boolean) => void;
  rawVibes: boolean;
  onToggleRawVibes: (enabled: boolean) => void;
  isSignedIn: boolean;
}

export function GenerateSection({
  generating,
  genError,
  cooldownUntil,
  targetTrackCount,
  onTargetChange,
  onTargetSave,
  gamesCount,
  games,
  onGenerate,
  allowLongTracks,
  onToggleLongTracks,
  allowShortTracks,
  onToggleShortTracks,
  rawVibes,
  onToggleRawVibes,
  isSignedIn,
}: GenerateSectionProps) {
  const { secsLeft, quip } = useCooldownTimer(cooldownUntil);

  return (
    <div className="flex flex-col">
      <GenerateControls
        targetTrackCount={targetTrackCount}
        onTargetChange={onTargetChange}
        onTargetSave={onTargetSave}
        gamesCount={gamesCount}
        onGenerate={onGenerate}
        allowLongTracks={allowLongTracks}
        onToggleLongTracks={onToggleLongTracks}
        allowShortTracks={allowShortTracks}
        onToggleShortTracks={onToggleShortTracks}
        rawVibes={rawVibes}
        onToggleRawVibes={onToggleRawVibes}
        isSignedIn={isSignedIn}
        generating={generating}
        secsLeft={secsLeft}
        quip={quip}
      />

      {generating && <GenerateProgressLine games={games} />}

      {genError && secsLeft === 0 && (
        <div className="mt-2 flex items-start gap-2 rounded-xl border border-red-500/20 bg-red-950/40 px-3 py-2.5 text-xs text-red-400">
          <ErrorCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {genError}
        </div>
      )}
    </div>
  );
}
