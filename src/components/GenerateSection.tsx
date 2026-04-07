"use client";

import { useState, type SyntheticEvent } from "react";
import { GameProgressStatus } from "@/types";
import type { GameProgressEntry } from "@/hooks/player/usePlaylist";
import { Spinner, CheckIcon, XIcon, ErrorCircle } from "@/components/Icons";
import { useCooldownTimer } from "@/hooks/shared/useCooldownTimer";
import { GenerateControls } from "@/components/GenerateControls";
import { ImportSection } from "@/components/ImportSection";

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
  // Import-related props
  importUrl: string;
  onImportUrlChange: (url: string) => void;
  importing: boolean;
  importError: string | null;
  onImport: (e: SyntheticEvent<HTMLFormElement>) => void;
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
  importUrl,
  onImportUrlChange,
  importing,
  importError,
  onImport,
}: GenerateSectionProps) {
  const [mode, setMode] = useState<"generate" | "import">("generate");
  const { secsLeft, quip } = useCooldownTimer(cooldownUntil);

  const showGenerate = mode === "generate" && !generating;
  const showProgress = mode === "generate" && generating;
  const showImport = mode === "import";

  return (
    <div className="flex flex-col">
      {/* Generate mode — progress (animated in/out) */}
      <div
        className={`grid transition-[grid-template-rows] duration-250 ease-in-out ${
          showProgress ? "[grid-template-rows:1fr]" : "[grid-template-rows:0fr]"
        }`}
      >
        <div
          className={`overflow-hidden transition-opacity duration-200 ${
            showProgress ? "opacity-100" : "opacity-0"
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

      {/* Animated card slot — both panels live here, no gap between them */}
      <div className="flex flex-col">
        {/* Generate mode — control card */}
        <div
          className={`grid transition-[grid-template-rows] duration-250 ease-in-out ${
            showGenerate ? "[grid-template-rows:1fr]" : "[grid-template-rows:0fr]"
          }`}
        >
          <div
            className={`transition-opacity duration-200 ${
              showGenerate ? "overflow-visible opacity-100" : "overflow-hidden opacity-0"
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
              onSwitchToImport={() => setMode("import")}
            />
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
            <ImportSection
              importUrl={importUrl}
              onImportUrlChange={onImportUrlChange}
              importing={importing}
              onImport={onImport}
              onSwitchToGenerate={() => setMode("generate")}
            />
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
