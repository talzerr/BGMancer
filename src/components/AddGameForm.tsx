"use client";

import { useState } from "react";
import type { SyntheticEvent } from "react";
import type { VibePreference, Game } from "@/types";
import { VIBE_LABELS } from "@/types";

interface AddGameFormProps {
  onGameAdded: (game: Game) => void;
}

export function AddGameForm({ onGameAdded }: AddGameFormProps) {
  const [title, setTitle] = useState("");
  const [vibe, setVibe] = useState<VibePreference>("official_soundtrack");
  const [allowFullOST, setAllowFullOST] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const vibeOptions = Object.entries(VIBE_LABELS) as [VibePreference, string][];

  async function handleSubmit(e: SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!title.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/games", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          vibe_preference: vibe,
          allow_full_ost: allowFullOST,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to add game");
      }

      const game: Game = await res.json();
      onGameAdded(game);
      setTitle("");
      setAllowFullOST(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2.5">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="game-title" className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest">
          Game Title
        </label>
        <input
          id="game-title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Elden Ring, Persona 5…"
          disabled={loading}
          className="w-full rounded-lg bg-zinc-800/80 border border-white/[0.07] px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500/50 disabled:opacity-50"
        />
      </div>

      <div className="flex gap-2">
        <div className="flex flex-col gap-1.5 flex-1">
          <label htmlFor="vibe" className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest">
            Vibe
          </label>
          <select
            id="vibe"
            value={vibe}
            onChange={(e) => setVibe(e.target.value as VibePreference)}
            disabled={loading}
            className="w-full rounded-lg bg-zinc-800/80 border border-white/[0.07] px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500/50 disabled:opacity-50 appearance-none cursor-pointer"
          >
            {vibeOptions.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5 justify-end">
          <div className="text-[10px] text-transparent select-none" aria-hidden>·</div>
          <button
            type="submit"
            disabled={loading || !title.trim()}
            className="rounded-lg bg-violet-600 hover:bg-violet-500 disabled:bg-zinc-800 disabled:text-zinc-600 disabled:border disabled:border-white/[0.05] px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-900/30 focus:outline-none focus:ring-2 focus:ring-violet-500/50 cursor-pointer disabled:cursor-not-allowed whitespace-nowrap"
          >
            {loading ? "Adding…" : "Add Game"}
          </button>
        </div>
      </div>

      {/* Full OST toggle */}
      <label className="flex items-center gap-3 cursor-pointer select-none w-fit group">
        <button
          type="button"
          role="switch"
          aria-checked={allowFullOST}
          onClick={() => setAllowFullOST((v) => !v)}
          className={`relative inline-flex h-5 w-9 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 ${
            allowFullOST ? "bg-violet-600" : "bg-zinc-700"
          }`}
        >
          <span
            className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
              allowFullOST ? "translate-x-4" : "translate-x-0"
            }`}
          />
        </button>
        <div>
          <span className="text-sm font-medium text-zinc-300 group-hover:text-white transition-colors">Full OST</span>
          <p className="text-xs text-zinc-400 mt-0.5">
            {allowFullOST
              ? "Will find one long compilation video for this game"
              : "Will find individual tracks (counts toward playlist total)"}
          </p>
        </div>
      </label>

      {error && (
        <p className="text-xs text-red-400 flex items-center gap-1.5">
          <svg className="w-3 h-3 shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          {error}
        </p>
      )}
    </form>
  );
}
