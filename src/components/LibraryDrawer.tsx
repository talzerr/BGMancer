"use client";

import { CurationMode } from "@/types";
import type { Game } from "@/types";
import { steamHeaderUrl } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useState } from "react";

interface LibraryDrawerProps {
  games: Game[];
  targetTrackCount: number;
  generating: boolean;
  onCurationChange: (gameId: string, curation: CurationMode) => void;
  onRemove: (gameId: string) => void;
  onGenerate: () => void;
}

const CURATION_CYCLE: CurationMode[] = [
  CurationMode.Focus,
  CurationMode.Include,
  CurationMode.Lite,
];

const CURATION_BADGE: Record<string, { label: string; className: string }> = {
  [CurationMode.Focus]: { label: "Focus", className: "bg-amber-500/15 text-amber-400" },
  [CurationMode.Include]: { label: "Include", className: "bg-violet-500/15 text-violet-400" },
  [CurationMode.Lite]: { label: "Lite", className: "bg-blue-500/15 text-blue-400" },
};

function GameThumbnail({ game }: { game: Game }) {
  const [failed, setFailed] = useState(false);

  if (game.steam_appid && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={steamHeaderUrl(game.steam_appid)}
        alt={game.title}
        width={48}
        height={22}
        loading="lazy"
        className="h-[22px] w-[48px] shrink-0 rounded bg-zinc-800 object-cover"
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <div className="flex h-[22px] w-[48px] shrink-0 items-center justify-center rounded bg-zinc-800/60">
      <span className="text-[9px] font-bold text-zinc-500 uppercase">{game.title.charAt(0)}</span>
    </div>
  );
}

export function LibraryDrawer({
  games,
  targetTrackCount,
  generating,
  onCurationChange,
  onRemove,
  onGenerate,
}: LibraryDrawerProps) {
  const hasActiveGames = games.length > 0;

  function cycleCuration(game: Game) {
    const currentIndex = CURATION_CYCLE.indexOf(game.curation);
    const nextIndex = (currentIndex + 1) % CURATION_CYCLE.length;
    onCurationChange(game.id, CURATION_CYCLE[nextIndex]);
  }

  return (
    <div className="sticky top-[57px] hidden max-h-[calc(100vh-57px)] w-[300px] shrink-0 flex-col border-l border-white/[0.04] bg-zinc-950/80 lg:flex">
      {/* Header */}
      <div
        className={`flex items-center justify-between px-4 py-3 ${games.length > 0 ? "border-b border-white/[0.06]" : ""}`}
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-zinc-100">Library</span>
          <span className="text-xs text-zinc-500 tabular-nums">{games.length}</span>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <span className="cursor-help text-[10px] text-zinc-600 hover:text-zinc-400">ⓘ</span>
              </TooltipTrigger>
              <TooltipContent
                side="bottom"
                className="!block max-w-[220px] space-y-1.5 border border-violet-500/10 !bg-zinc-950 p-3 text-xs shadow-lg shadow-black/40"
              >
                <div>
                  <span className="font-medium text-amber-400">Focus</span>
                  <span className="text-zinc-400"> — more tracks from this game</span>
                </div>
                <div>
                  <span className="font-medium text-violet-400">Include</span>
                  <span className="text-zinc-400"> — normal amount</span>
                </div>
                <div>
                  <span className="font-medium text-blue-400">Lite</span>
                  <span className="text-zinc-400"> — fewer tracks from this game</span>
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      {/* Content area */}
      {games.length === 0 ? (
        <div className="relative flex flex-1 flex-col items-center justify-center px-6 text-center">
          {/* Subtle radial glow behind content */}
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(139,92,246,0.06)_0%,transparent_70%)]" />

          {/* Equalizer icon — 5 bars, paused, with slight violet tint */}
          <div className="relative mb-5 flex items-end gap-[3px]">
            <div className="h-2.5 w-[3px] rounded-full bg-violet-500/20" />
            <div className="h-4 w-[3px] rounded-full bg-violet-500/25" />
            <div className="h-6 w-[3px] rounded-full bg-violet-500/30" />
            <div className="h-3.5 w-[3px] rounded-full bg-violet-500/25" />
            <div className="h-2 w-[3px] rounded-full bg-violet-500/20" />
          </div>

          <p className="font-display relative text-[15px] font-semibold text-zinc-200">
            Your library is empty
          </p>
          <p className="relative mt-2 max-w-[200px] text-xs leading-relaxed text-zinc-500">
            Add a few soundtracks from the catalog to start your first session.
          </p>

          {/* Fade to transparent at bottom */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-zinc-950/80 to-transparent" />
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          <div className="flex flex-col gap-px p-2">
            {games.map((game) => (
              <div
                key={game.id}
                className="group flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-zinc-900/60"
              >
                <GameThumbnail game={game} />

                <span className="min-w-0 flex-1 truncate text-[13px] text-zinc-300">
                  {game.title}
                </span>

                <button
                  onClick={() => cycleCuration(game)}
                  className={`shrink-0 cursor-pointer rounded-md px-1.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase transition-colors ${(CURATION_BADGE[game.curation] ?? CURATION_BADGE[CurationMode.Include]).className}`}
                >
                  {(CURATION_BADGE[game.curation] ?? CURATION_BADGE[CurationMode.Include]).label}
                </button>

                <button
                  onClick={() => onRemove(game.id)}
                  className="shrink-0 cursor-pointer rounded-md p-0.5 text-zinc-600 opacity-0 transition-all group-hover:opacity-100 hover:text-red-400"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    className="h-3.5 w-3.5"
                  >
                    <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      {hasActiveGames && (
        <div className="border-t border-white/[0.06] px-4 py-3">
          <div className="mb-2.5 flex items-center justify-between text-xs text-zinc-500">
            <span className="tabular-nums">
              {games.length} game{games.length !== 1 ? "s" : ""}
            </span>
            <span className="tabular-nums">{targetTrackCount} tracks</span>
          </div>
          <Button
            onClick={onGenerate}
            disabled={generating}
            className="w-full cursor-pointer bg-violet-600 text-sm font-semibold text-white hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {generating ? "Curating\u2026" : `Curate ${targetTrackCount} Tracks`}
          </Button>
        </div>
      )}
    </div>
  );
}
