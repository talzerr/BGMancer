"use client";

import { useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { StatusBadge } from "@/components/backstage/StatusBadge";
import { PhaseStepper } from "@/components/backstage/PhaseStepper";
import { EditableTitle } from "@/components/backstage/EditableTitle";
import { PrimaryAction } from "@/components/backstage/PrimaryAction";
import { DropdownItem } from "@/components/backstage/DropdownItem";
import { BackstageModal, OnboardingPhase } from "@/types";
import type { Game, Track } from "@/types";
import type { ReviewFlag } from "@/lib/db/repos/review-flags";
import type { GameDetailActions } from "../_hooks/useGameDetailActions";
import type { ActiveModal } from "../game-detail-client";

export function GameHeader({
  game,
  tracks,
  reviewFlags,
  actions,
  onSetActiveModal,
  flagsRef,
}: {
  game: Game;
  tracks: Track[];
  reviewFlags: ReviewFlag[];
  actions: GameDetailActions;
  onSetActiveModal: (modal: ActiveModal) => void;
  flagsRef: React.RefObject<HTMLDetailsElement | null>;
}) {
  const [pipelineOpen, setPipelineOpen] = useState(false);
  const [dangerOpen, setDangerOpen] = useState(false);

  const trackCount = tracks.filter((t) => t.discovered !== "rejected").length;
  const activeCount = tracks.filter((t) => t.active).length;
  const taggedCount = tracks.filter((t) => t.taggedAt !== null).length;
  const phase = game.onboarding_phase;
  const thumbnailSrc = game.thumbnail_url;

  return (
    <div className="flex items-start gap-4 rounded-lg border border-zinc-800 bg-zinc-900/60 px-4 py-4">
      <div className="flex min-w-0 flex-1 gap-4">
        {thumbnailSrc && (
          <Image
            src={thumbnailSrc}
            alt={game.title}
            width={184}
            height={69}
            loading="eager"
            unoptimized
            className="shrink-0 rounded-md object-cover"
            style={{ width: 184, height: "auto" }}
          />
        )}
        <div className="min-w-0 space-y-2">
          <div className="flex items-center gap-2">
            <EditableTitle
              value={game.title}
              disabled={game.published}
              onSave={(v) => actions.saveField("title", v)}
            />
            <StatusBadge phase={phase} />
          </div>

          <PhaseStepper currentPhase={phase} published={game.published} />

          <div className="flex flex-wrap gap-4 font-mono text-[11px] text-zinc-500">
            <span>{trackCount} tracks</span>
            <span>{activeCount} active</span>
            <span>{taggedCount} tagged</span>
            {reviewFlags.length > 0 && (
              <span className="text-amber-400">{reviewFlags.length} review flags</span>
            )}
          </div>
        </div>
      </div>

      {/* Controls — stacked on the right */}
      <div className="flex shrink-0 flex-col items-end gap-2">
        {/* Action bar */}
        <div className="flex items-center gap-2">
          <PrimaryAction
            phase={phase}
            trackCount={tracks.length}
            reviewFlagCount={reviewFlags.length}
            onMarkReady={actions.markTracksReady}
            onRetry={() => onSetActiveModal(BackstageModal.LoadTracks)}
            onTag={() => onSetActiveModal(BackstageModal.Retag)}
            onResolve={() => onSetActiveModal(BackstageModal.Resolve)}
            onReviewFlags={() => flagsRef.current?.scrollIntoView({ behavior: "smooth" })}
          />

          <div className="relative">
            <Button
              size="sm"
              variant="outline"
              className="h-7 border-zinc-700 text-xs text-zinc-300 hover:text-zinc-100"
              disabled={game.published}
              onClick={() => setPipelineOpen((o) => !o)}
              onBlur={() => setTimeout(() => setPipelineOpen(false), 150)}
            >
              Run Pipeline ▾
            </Button>
            {pipelineOpen && (
              <div className="absolute right-0 z-10 mt-1 w-48 rounded-md border border-zinc-700 bg-zinc-900 py-1 shadow-lg">
                <DropdownItem
                  onClick={() => {
                    setPipelineOpen(false);
                    onSetActiveModal(BackstageModal.QuickOnboard);
                  }}
                >
                  Run Full Pipeline
                </DropdownItem>
                <DropdownItem
                  onClick={() => {
                    setPipelineOpen(false);
                    onSetActiveModal(BackstageModal.LoadTracks);
                  }}
                >
                  Fetch from Discogs
                </DropdownItem>
                <DropdownItem
                  onClick={() => {
                    setPipelineOpen(false);
                    onSetActiveModal(BackstageModal.ImportTracks);
                  }}
                >
                  Paste Tracks
                </DropdownItem>
                <DropdownItem
                  onClick={() => {
                    setPipelineOpen(false);
                    onSetActiveModal(BackstageModal.Retag);
                  }}
                >
                  Force Re-Tag
                </DropdownItem>
                <DropdownItem
                  onClick={() => {
                    setPipelineOpen(false);
                    onSetActiveModal(BackstageModal.Resolve);
                  }}
                >
                  Force Re-Resolve
                </DropdownItem>
              </div>
            )}
          </div>

          <div className="relative">
            <Button
              size="sm"
              variant="outline"
              className="h-7 w-7 border-zinc-700 p-0 text-xs text-zinc-500 hover:text-zinc-300"
              disabled={game.published}
              onClick={() => setDangerOpen((o) => !o)}
              onBlur={() => setTimeout(() => setDangerOpen(false), 150)}
            >
              ⋯
            </Button>
            {dangerOpen && (
              <div className="absolute right-0 z-10 mt-1 w-52 rounded-md border border-zinc-700 bg-zinc-900 py-1 shadow-lg">
                <DropdownItem
                  destructive
                  onClick={() => {
                    setDangerOpen(false);
                    onSetActiveModal(BackstageModal.Reingest);
                  }}
                >
                  Reset Pipeline (Re-Sync Source)
                </DropdownItem>
                <DropdownItem
                  destructive
                  onClick={() => {
                    setDangerOpen(false);
                    onSetActiveModal(BackstageModal.Nuke);
                  }}
                >
                  Delete Game
                </DropdownItem>
              </div>
            )}
          </div>
        </div>

        {/* Publish button */}
        <Tooltip>
          <TooltipTrigger
            render={
              <button
                className={`group w-[110px] shrink-0 rounded-lg py-1.5 text-center text-xs font-semibold transition-all ${
                  game.published
                    ? "border border-emerald-600/40 bg-emerald-500/10 text-emerald-400 hover:border-rose-500/40 hover:bg-rose-500/10 hover:text-rose-400"
                    : phase === OnboardingPhase.Tagged
                      ? "bg-emerald-600 text-white shadow-sm shadow-emerald-500/25 hover:bg-emerald-700"
                      : "cursor-not-allowed border border-zinc-700 text-zinc-600"
                }`}
                disabled={actions.publishing || phase !== OnboardingPhase.Tagged}
                onClick={actions.togglePublished}
              >
                {game.published ? (
                  <>
                    <span className="group-hover:hidden">● Published</span>
                    <span className="hidden group-hover:inline">Unpublish</span>
                  </>
                ) : (
                  "Publish"
                )}
              </button>
            }
          />
          {phase !== OnboardingPhase.Tagged && !game.published && (
            <TooltipContent>Complete all pipeline phases before publishing</TooltipContent>
          )}
        </Tooltip>
      </div>
    </div>
  );
}
