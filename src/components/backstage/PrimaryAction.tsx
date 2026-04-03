"use client";

import { Button } from "@/components/ui/button";
import { OnboardingPhase } from "@/types";

export function PrimaryAction({
  phase,
  trackCount,
  reviewFlagCount,
  onMarkReady,
  onRetry,
  onTag,
  onResolve,
  onReviewFlags,
}: {
  phase: OnboardingPhase;
  trackCount: number;
  reviewFlagCount: number;
  onMarkReady: () => void;
  onRetry: () => void;
  onTag: () => void;
  onResolve: () => void;
  onReviewFlags: () => void;
}) {
  const hasFlags = reviewFlagCount > 0;

  if (hasFlags && phase !== OnboardingPhase.Tagged) {
    return (
      <Button
        size="sm"
        className="h-7 bg-amber-600 text-xs text-white hover:bg-amber-700"
        onClick={onReviewFlags}
      >
        Review Flags ({reviewFlagCount})
      </Button>
    );
  }

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
          className="h-7 bg-violet-600 text-xs text-white hover:bg-violet-700"
          onClick={onResolve}
        >
          Resolve Videos
        </Button>
      );
    case OnboardingPhase.Resolved:
      return (
        <Button
          size="sm"
          className="h-7 bg-violet-600 text-xs text-white hover:bg-violet-700"
          onClick={onTag}
        >
          Run LLM Tagging
        </Button>
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
          className="h-7 bg-violet-600 text-xs text-white hover:bg-violet-700"
          onClick={onRetry}
        >
          Retry: Fetch Tracklist
        </Button>
      );
  }
}
