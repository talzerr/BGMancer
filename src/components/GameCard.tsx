"use client";

import { useState } from "react";
import type { Game } from "@/types";
import { VIBE_LABELS } from "@/types";

interface GameCardProps {
  game: Game;
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

export function GameCard({ game, onToggleFullOST, onDelete }: GameCardProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const vibeStyle = VIBE_STYLES[game.vibe_preference] ?? DEFAULT_VIBE_STYLE;

  return (
    <div className="group flex items-center gap-3 rounded-xl bg-zinc-900/60 border border-white/[0.05] px-3.5 py-3 hover:border-white/[0.10] transition-all duration-150">
      {/* Vibe indicator dot */}
      <div className={`shrink-0 w-1.5 h-1.5 rounded-full mt-0.5 ${vibeStyle.dot}`} />

      {/* Game info */}
      <div className="flex-1 min-w-0">
        <p className="font-medium text-zinc-100 truncate text-sm leading-tight">{game.title}</p>
        <span className={`inline-block mt-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full border leading-none ${vibeStyle.badge}`}>
          {VIBE_LABELS[game.vibe_preference] ?? game.vibe_preference}
        </span>
      </div>

      {/* Full OST toggle */}
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-[11px] text-zinc-600 hidden sm:inline">Full OST</span>
        <button
          role="switch"
          aria-checked={game.allow_full_ost}
          onClick={() => onToggleFullOST(game.id, !game.allow_full_ost)}
          className={`relative inline-flex h-5 w-9 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 ${
            game.allow_full_ost ? "bg-violet-600" : "bg-zinc-700"
          }`}
        >
          <span
            className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
              game.allow_full_ost ? "translate-x-4" : "translate-x-0"
            }`}
          />
        </button>
      </div>

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
