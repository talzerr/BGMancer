"use client";

import { useState } from "react";
import type { Game } from "@/types";
import { TrashIcon } from "@/components/Icons";

interface GameCardProps {
  game: Game;
  isActive?: boolean;
  onDelete: (gameId: string) => void;
}

export function GameCard({ game, isActive = false, onDelete }: GameCardProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <div
      className={`group flex items-center gap-3 rounded-xl border px-3.5 py-2.5 transition-all duration-300 ${
        isActive
          ? "bg-violet-950/40 border-violet-600/50 shadow-sm shadow-violet-900/20"
          : "bg-zinc-900/60 border-white/[0.05] hover:border-white/[0.10]"
      }`}
    >
      {/* Active indicator dot */}
      <div className="relative shrink-0 flex items-center justify-center w-3 h-3">
        <div className={`w-1.5 h-1.5 rounded-full ${isActive ? "bg-violet-400" : "bg-zinc-600"}`} />
        {isActive && (
          <div className="absolute inset-0 rounded-full bg-violet-400 opacity-40 animate-ping" />
        )}
      </div>

      {/* Game info */}
      <div className="flex-1 min-w-0">
        <p className={`font-medium truncate text-sm leading-tight transition-colors ${isActive ? "text-white" : "text-zinc-100"}`}>
          {game.title}
        </p>
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
          className="shrink-0 rounded-lg p-1.5 text-zinc-600 hover:text-red-400 hover:bg-red-500/10 cursor-pointer opacity-0 group-hover:opacity-100 transition-all"
          title="Remove game"
        >
          <TrashIcon />
        </button>
      )}
    </div>
  );
}
