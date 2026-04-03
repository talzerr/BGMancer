"use client";

import { CurationMode } from "@/types";
import type { Game } from "@/types";
import { steamHeaderUrl } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useState } from "react";

interface LibraryDrawerProps {
  open: boolean;
  games: Game[];
  targetTrackCount: number;
  generating: boolean;
  onClose: () => void;
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
  open,
  games,
  targetTrackCount,
  generating,
  onClose,
  onCurationChange,
  onRemove,
  onGenerate,
}: LibraryDrawerProps) {
  if (!open) return null;

  const activeGames = games.filter((g) => g.curation !== CurationMode.Skip);
  const hasActiveGames = activeGames.length > 0;

  function cycleCuration(game: Game) {
    const currentIndex = CURATION_CYCLE.indexOf(game.curation);
    const nextIndex = (currentIndex + 1) % CURATION_CYCLE.length;
    onCurationChange(game.id, CURATION_CYCLE[nextIndex]);
  }

  return (
    <div className="flex h-full w-[300px] shrink-0 flex-col border-l border-zinc-800 bg-zinc-950/80">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-zinc-100">Library</span>
          <span className="text-xs text-zinc-500 tabular-nums">{games.length}</span>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <span className="cursor-help text-[10px] text-zinc-600 hover:text-zinc-400">ⓘ</span>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-[220px] space-y-1 text-xs">
                <p className="font-semibold text-zinc-200">Curation modes</p>
                <p>
                  <span className="font-medium text-amber-400">Focus</span>
                  <span className="text-zinc-400"> — guaranteed in every playlist</span>
                </p>
                <p>
                  <span className="font-medium text-violet-400">Include</span>
                  <span className="text-zinc-400"> — standard inclusion</span>
                </p>
                <p>
                  <span className="font-medium text-blue-400">Lite</span>
                  <span className="text-zinc-400"> — appears occasionally</span>
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <button
          onClick={onClose}
          className="cursor-pointer rounded-md p-1 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-300"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="h-4 w-4"
          >
            <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
          </svg>
        </button>
      </div>

      {/* Content area */}
      {games.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
          {/* Paused equalizer — 3 static bars at different heights */}
          <div className="mb-4 flex items-end gap-[3px]">
            <div className="h-3 w-[3px] rounded-full bg-zinc-700" />
            <div className="h-5 w-[3px] rounded-full bg-zinc-700" />
            <div className="h-2 w-[3px] rounded-full bg-zinc-700" />
          </div>
          <p className="font-display text-sm font-semibold text-zinc-300">Pick some soundtracks</p>
          <p className="mt-1.5 text-xs leading-relaxed text-zinc-600">
            The Director shapes them into a playlist arc
          </p>
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
        <div className="border-t border-zinc-800 px-4 py-3">
          <div className="mb-2.5 flex items-center justify-between text-xs text-zinc-500">
            <span className="tabular-nums">
              {activeGames.length} game{activeGames.length !== 1 ? "s" : ""}
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
