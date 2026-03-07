"use client";

import { useState } from "react";
import type { Game } from "@/types";
import { VIBE_LABELS } from "@/types";

interface GameCardProps {
  game: Game;
  onToggleFullOST: (gameId: string, value: boolean) => void;
  onDelete: (gameId: string) => void;
}

const VIBE_COLORS: Record<string, string> = {
  official_soundtrack: "bg-violet-500/20 text-violet-300",
  boss_themes: "bg-red-500/20 text-red-300",
  ambient_exploration: "bg-sky-500/20 text-sky-300",
};

export function GameCard({ game, onToggleFullOST, onDelete }: GameCardProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <div className="flex items-center gap-3 rounded-xl bg-zinc-800/60 border border-zinc-700/50 px-4 py-3 hover:border-zinc-600 transition-colors">
      {/* Game info */}
      <div className="flex-1 min-w-0">
        <p className="font-medium text-white truncate text-sm">{game.title}</p>
        <span className={`inline-block mt-1 text-xs font-medium px-2 py-0.5 rounded-full ${VIBE_COLORS[game.vibe_preference] ?? "bg-zinc-700 text-zinc-300"}`}>
          {VIBE_LABELS[game.vibe_preference] ?? game.vibe_preference}
        </span>
      </div>

      {/* Full OST toggle */}
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-xs text-zinc-400 hidden sm:inline">Full OST</span>
        <button
          role="switch"
          aria-checked={game.allow_full_ost}
          onClick={() => onToggleFullOST(game.id, !game.allow_full_ost)}
          className={`relative inline-flex h-5 w-9 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 ${
            game.allow_full_ost ? "bg-violet-600" : "bg-zinc-600"
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
            className="rounded-lg bg-red-600 hover:bg-red-500 px-2.5 py-1 text-xs font-medium text-white transition cursor-pointer"
          >
            Remove
          </button>
          <button
            onClick={() => setConfirmDelete(false)}
            className="rounded-lg bg-zinc-700 hover:bg-zinc-600 px-2.5 py-1 text-xs font-medium text-zinc-300 transition cursor-pointer"
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          onClick={() => setConfirmDelete(true)}
          className="shrink-0 rounded-lg bg-zinc-700/50 hover:bg-red-500/20 hover:text-red-400 p-1.5 text-zinc-500 transition cursor-pointer"
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
