"use client";

import { useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { StatusBadge } from "@/components/backstage/StatusBadge";
import { PhaseStepper } from "@/components/backstage/PhaseStepper";
import { EditableTitle } from "@/components/backstage/EditableTitle";
import { PrimaryAction } from "@/components/backstage/PrimaryAction";
import { Dropdown } from "@/components/backstage/Dropdown";
import { DropdownItem } from "@/components/backstage/DropdownItem";
import { BackstageModal, DiscoveredStatus, OnboardingPhase } from "@/types";
import type { Game, Track } from "@/types";
import type { ReviewFlag } from "@/lib/db/repos/review-flags";
import type { GameDetailActions } from "../_hooks/useGameDetailActions";
import type { ActiveModal } from "../GameDetailClient";

export function GameHeader({
  game,
  tracks,
  videoMap,
  reviewFlags,
  actions,
  onSetActiveModal,
}: {
  game: Game;
  tracks: Track[];
  videoMap: Record<string, string>;
  reviewFlags: ReviewFlag[];
  actions: GameDetailActions;
  onSetActiveModal: (modal: ActiveModal) => void;
}) {
  const [pipelineOpen, setPipelineOpen] = useState(false);
  const [dangerOpen, setDangerOpen] = useState(false);

  const trackCount = tracks.filter((t) => t.discovered !== "rejected").length;
  const activeCount = tracks.filter((t) => t.active).length;
  const taggedCount = tracks.filter((t) => t.taggedAt !== null).length;
  const unresolvedCount = tracks.filter(
    (t) => !videoMap[t.name] && t.discovered !== DiscoveredStatus.Rejected,
  ).length;
  const untaggedCount = tracks.filter(
    (t) => t.energy === null && t.discovered !== DiscoveredStatus.Rejected,
  ).length;
  const phase = game.onboarding_phase;
  const isDraft = phase === OnboardingPhase.Draft;
  const thumbnailSrc = game.thumbnail_url;

  return (
    <div className="border-border bg-secondary/60 flex items-start gap-4 rounded-lg border px-4 py-4">
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

          <div className="flex flex-wrap gap-4 font-mono text-[11px] text-[var(--text-tertiary)]">
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
            hasTaggedTracks={taggedCount > 0}
            onMarkReady={actions.markTracksReady}
            onRetry={() => onSetActiveModal(BackstageModal.LoadTracks)}
            onTag={() => onSetActiveModal(BackstageModal.TagSelected)}
            onResolve={() => onSetActiveModal(BackstageModal.Resolve)}
            onMarkTagged={actions.markTagged}
          />

          {isDraft ? (
            <Dropdown
              label="Run Pipeline ▾"
              open={pipelineOpen}
              onOpenChange={setPipelineOpen}
              disabled={game.published}
            >
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
            </Dropdown>
          ) : (
            <div className="flex items-center gap-1.5">
              {unresolvedCount > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  className="border-primary/40 text-primary hover:bg-primary/10 h-7 px-2 text-[10px]"
                  onClick={() => onSetActiveModal(BackstageModal.ResolveSelected)}
                  disabled={game.published}
                >
                  Resolve All ({unresolvedCount})
                </Button>
              )}
              {untaggedCount > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  className="border-primary/40 text-primary hover:bg-primary/10 h-7 px-2 text-[10px]"
                  onClick={() => onSetActiveModal(BackstageModal.TagSelected)}
                  disabled={game.published}
                >
                  Tag All ({untaggedCount})
                </Button>
              )}
            </div>
          )}

          <Dropdown
            label="⋯"
            open={dangerOpen}
            onOpenChange={setDangerOpen}
            disabled={game.published}
            buttonClassName="h-7 w-7 border-border p-0 text-xs text-[var(--text-tertiary)] hover:text-foreground"
            width="w-52"
          >
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
          </Dropdown>
        </div>

        {/* Publish button */}
        <Tooltip>
          <TooltipTrigger
            render={
              <button
                className={`group w-[110px] shrink-0 rounded-lg py-1.5 text-center text-xs font-medium transition-all ${
                  game.published
                    ? "border border-emerald-600/40 bg-emerald-500/10 text-emerald-400 hover:border-rose-500/40 hover:bg-rose-500/10 hover:text-rose-400"
                    : phase === OnboardingPhase.Tagged
                      ? "text-foreground bg-emerald-600 shadow-sm hover:bg-emerald-700"
                      : "border-border cursor-not-allowed border text-[var(--text-disabled)]"
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
