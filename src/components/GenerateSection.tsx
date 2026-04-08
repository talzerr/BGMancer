"use client";

import { GameProgressStatus } from "@/types";
import type { GameProgressEntry } from "@/hooks/player/usePlaylist";
import { Spinner, CheckIcon, XIcon, ErrorCircle } from "@/components/Icons";
import { useCooldownTimer } from "@/hooks/shared/useCooldownTimer";
import { GenerateControls } from "@/components/GenerateControls";

interface GenerateSectionProps {
  generating: boolean;
  genProgress: GameProgressEntry[];
  genError: string | null;
  cooldownUntil: number;
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
}

export function GenerateSection({
  generating,
  genProgress,
  genError,
  cooldownUntil,
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
}: GenerateSectionProps) {
  const { secsLeft, quip } = useCooldownTimer(cooldownUntil);

  return (
    <div className="flex flex-col">
      {/* Progress card (animated in/out) */}
      <div
        className={`grid transition-[grid-template-rows] duration-250 ease-in-out ${
          generating ? "[grid-template-rows:1fr]" : "[grid-template-rows:0fr]"
        }`}
      >
        <div
          className={`overflow-hidden transition-opacity duration-200 ${
            generating ? "opacity-100" : "opacity-0"
          }`}
        >
          <div className="bg-secondary/70 mb-2 flex flex-col gap-3 rounded-xl border border-[var(--border-emphasis)] p-4">
            <div className="flex items-center gap-2">
              <Spinner className="text-primary h-3 w-3 shrink-0" />
              <span className="text-primary text-[11px] font-medium tracking-widest uppercase">
                Curating your playlist…
              </span>
            </div>

            <div className="flex flex-col gap-1.5">
              {genProgress.map((entry) => (
                <div key={entry.id} className="flex min-w-0 items-start gap-2">
                  <div className="mt-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center">
                    {entry.status === GameProgressStatus.Active ? (
                      <Spinner className="text-primary h-3 w-3" />
                    ) : entry.status === GameProgressStatus.Done ? (
                      <CheckIcon className="text-primary h-3 w-3" />
                    ) : entry.status === GameProgressStatus.Error ? (
                      <XIcon className="h-3 w-3 text-red-400" />
                    ) : (
                      <span className="block h-1.5 w-1.5 rounded-full bg-[var(--text-disabled)]" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <span
                      className={`truncate text-xs font-medium ${
                        entry.status === GameProgressStatus.Active
                          ? "text-foreground"
                          : entry.status === GameProgressStatus.Done
                            ? "text-muted-foreground"
                            : entry.status === GameProgressStatus.Error
                              ? "text-red-400"
                              : "text-[var(--text-disabled)]"
                      }`}
                    >
                      {entry.title}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Controls card (animated in/out) */}
      <div
        className={`grid transition-[grid-template-rows] duration-250 ease-in-out ${
          !generating ? "[grid-template-rows:1fr]" : "[grid-template-rows:0fr]"
        }`}
      >
        <div
          className={`transition-opacity duration-200 ${
            !generating ? "overflow-visible opacity-100" : "overflow-hidden opacity-0"
          }`}
        >
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
            secsLeft={secsLeft}
            quip={quip}
          />
        </div>
      </div>

      {genError && secsLeft === 0 && (
        <div className="flex items-start gap-2 rounded-xl border border-red-500/20 bg-red-950/40 px-3 py-2.5 text-xs text-red-400">
          <ErrorCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {genError}
        </div>
      )}
    </div>
  );
}
