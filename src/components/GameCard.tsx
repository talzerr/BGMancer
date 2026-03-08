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
          ? "border-violet-600/50 bg-violet-950/40 shadow-sm shadow-violet-900/20"
          : "border-white/[0.05] bg-zinc-900/60 hover:border-white/[0.10]"
      }`}
    >
      {/* Active indicator dot */}
      <div className="relative flex h-3 w-3 shrink-0 items-center justify-center">
        <div className={`h-1.5 w-1.5 rounded-full ${isActive ? "bg-violet-400" : "bg-zinc-600"}`} />
        {isActive && (
          <div className="absolute inset-0 animate-ping rounded-full bg-violet-400 opacity-40" />
        )}
      </div>

      {/* Game info */}
      <div className="min-w-0 flex-1">
        <p
          className={`truncate text-sm leading-tight font-medium transition-colors ${isActive ? "text-white" : "text-zinc-100"}`}
        >
          {game.title}
        </p>
      </div>

      {/* Delete */}
      {confirmDelete ? (
        <div className="flex shrink-0 items-center gap-1">
          <button
            onClick={() => onDelete(game.id)}
            className="cursor-pointer rounded-lg bg-red-600/90 px-2.5 py-1 text-xs font-medium text-white hover:bg-red-500"
          >
            Remove
          </button>
          <button
            onClick={() => setConfirmDelete(false)}
            className="cursor-pointer rounded-lg bg-zinc-800 px-2.5 py-1 text-xs font-medium text-zinc-400 hover:bg-zinc-700"
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          onClick={() => setConfirmDelete(true)}
          className="shrink-0 cursor-pointer rounded-lg p-1.5 text-zinc-600 opacity-0 transition-all group-hover:opacity-100 hover:bg-red-500/10 hover:text-red-400"
          title="Remove game"
        >
          <TrashIcon />
        </button>
      )}
    </div>
  );
}
