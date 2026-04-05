"use client";

import { Button } from "@/components/ui/button";
import { OnboardingPhase } from "@/types";

export function PrimaryAction({
  phase,
  trackCount,
  hasTaggedTracks,
  onMarkReady,
  onRetry,
  onTag,
  onResolve,
  onMarkTagged,
}: {
  phase: OnboardingPhase;
  trackCount: number;
  hasTaggedTracks: boolean;
  onMarkReady: () => void;
  onRetry: () => void;
  onTag: () => void;
  onResolve: () => void;
  onMarkTagged: () => void;
}) {
  switch (phase) {
    case OnboardingPhase.Draft:
      if (trackCount > 0) {
        return (
          <Button
            size="sm"
            className="h-7 bg-emerald-600 text-xs text-white hover:bg-emerald-700"
            onClick={onMarkReady}
          >
            Mark Tracks Ready
          </Button>
        );
      }
      return null;
    case OnboardingPhase.TracksLoaded:
      return (
        <Button
          size="sm"
          className="bg-primary text-primary-foreground h-7 text-xs hover:bg-[var(--primary-hover)]"
          onClick={onResolve}
        >
          Resolve Videos
        </Button>
      );
    case OnboardingPhase.Resolved:
      return (
        <div className="flex items-center gap-1.5">
          <Button
            size="sm"
            className="bg-primary text-primary-foreground h-7 text-xs hover:bg-[var(--primary-hover)]"
            onClick={onTag}
          >
            Run LLM Tagging
          </Button>
          {hasTaggedTracks && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 border-emerald-600/40 text-xs text-emerald-400 hover:bg-emerald-500/10"
              onClick={onMarkTagged}
            >
              Mark Tagged
            </Button>
          )}
        </div>
      );
    case OnboardingPhase.Tagged:
      return (
        <Button
          size="sm"
          variant="outline"
          className="pointer-events-none h-7 border-emerald-700/40 text-xs text-emerald-400"
          disabled
        >
          Pipeline complete
        </Button>
      );
    case OnboardingPhase.Failed:
      return (
        <Button
          size="sm"
          className="bg-primary text-primary-foreground h-7 text-xs hover:bg-[var(--primary-hover)]"
          onClick={onRetry}
        >
          Retry: Fetch Tracklist
        </Button>
      );
  }
}
