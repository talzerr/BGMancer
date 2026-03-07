"use client";

import { useState } from "react";
import type { Game } from "@/types";
import { VIBE_LABELS } from "@/types";

interface GameCardProps {
  game: Game;
  isActive?: boolean;
  onToggleFullOST: (gameId: string, value: boolean) => void;
  onDelete: (gameId: string) => void;
}

const VIBE_STYLES: Record<string, { badge: string; dot: string }> = {
  official_soundtrack: {
    badge: "bg-violet-500/15 text-violet-300 border-violet-500/20",
    dot: "bg-violet-400",
  },
  boss_themes: {
    badge: "bg-red-500/15 text-red-300 border-red-500/20",
    dot: "bg-red-400",
  },
  ambient_exploration: {
    badge: "bg-sky-500/15 text-sky-300 border-sky-500/20",
    dot: "bg-sky-400",
  },
};

const DEFAULT_VIBE_STYLE = {
  badge: "bg-zinc-700/50 text-zinc-400 border-zinc-600/30",
  dot: "bg-zinc-500",
};

export function GameCard({ game, isActive = false, onToggleFullOST, onDelete }: GameCardProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const vibeStyle = VIBE_STYLES[game.vibe_preference] ?? DEFAULT_VIBE_STYLE;

  return (
    <div
      className={`group flex items-center gap-3 rounded-xl border px-3.5 py-2.5 transition-all duration-300 ${
        isActive
          ? "bg-violet-950/40 border-violet-600/50 shadow-sm shadow-violet-900/20"
          : "bg-zinc-900/60 border-white/[0.05] hover:border-white/[0.10]"
      }`}
    >
      {/* Vibe dot — pulses when this game's track is playing */}
      <div className="relative shrink-0 flex items-center justify-center w-3 h-3">
        <div className={`w-1.5 h-1.5 rounded-full ${vibeStyle.dot}`} />
        {isActive && (
          <div className={`absolute inset-0 rounded-full ${vibeStyle.dot} opacity-40 animate-ping`} />
        )}
      </div>

      {/* Game info */}
      <div className="flex-1 min-w-0">
        <p className={`font-medium truncate text-sm leading-tight transition-colors ${isActive ? "text-white" : "text-zinc-100"}`}>
          {game.title}
        </p>
        <div className="flex items-center gap-1.5 mt-1">
          <span className={`inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded-full border leading-none ${vibeStyle.badge}`}>
            {VIBE_LABELS[game.vibe_preference] ?? game.vibe_preference}
          </span>
          {game.allow_full_ost && (
            <span className="inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded-full border leading-none bg-zinc-700/50 text-zinc-400 border-zinc-600/30">
              Full OST
            </span>
          )}
        </div>
      </div>

      {/* Full OST icon toggle — compact, labelled on hover */}
      <button
        role="switch"
        aria-checked={game.allow_full_ost}
        onClick={() => onToggleFullOST(game.id, !game.allow_full_ost)}
        title={game.allow_full_ost ? "Full OST: on (find one compilation)" : "Full OST: off (individual tracks)"}
        className={`shrink-0 p-1.5 rounded-lg transition-all cursor-pointer ${
          game.allow_full_ost
            ? "text-violet-400 bg-violet-500/15 border border-violet-500/20"
            : "text-zinc-600 hover:text-zinc-400 bg-transparent border border-transparent hover:border-white/[0.06]"
        }`}
      >
        {/* "Film / compilation" icon */}
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
        </svg>
      </button>

      {/* Delete */}
      {confirmDelete ? (
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => onDelete(game.id)}
            className="rounded-lg bg-red-600/90 hover:bg-red-500 px-2.5 py-1 text-xs font-medium text-white cursor-pointer"
          >
            Remove
          </button>
          <button
            onClick={() => setConfirmDelete(false)}
            className="rounded-lg bg-zinc-800 hover:bg-zinc-700 px-2.5 py-1 text-xs font-medium text-zinc-400 cursor-pointer"
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          onClick={() => setConfirmDelete(true)}
          className="shrink-0 rounded-lg p-1.5 text-zinc-700 hover:text-red-400 hover:bg-red-500/10 cursor-pointer opacity-0 group-hover:opacity-100 transition-all"
          title="Remove game"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      )}
    </div>
  );
}
