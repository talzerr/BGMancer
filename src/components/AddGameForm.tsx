"use client";

import { useState } from "react";
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

  async function handleSubmit(e: React.FormEvent) {
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
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1 flex flex-col gap-1">
          <label htmlFor="game-title" className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
            Game Title
          </label>
          <input
            id="game-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Elden Ring, Persona 5, Hollow Knight…"
            disabled={loading}
            className="rounded-lg bg-zinc-800 border border-zinc-700 px-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent disabled:opacity-50 transition"
          />
        </div>

        <div className="flex flex-col gap-1 sm:w-52">
          <label htmlFor="vibe" className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
            Vibe
          </label>
          <select
            id="vibe"
            value={vibe}
            onChange={(e) => setVibe(e.target.value as VibePreference)}
            disabled={loading}
            className="rounded-lg bg-zinc-800 border border-zinc-700 px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent disabled:opacity-50 transition appearance-none"
          >
            {vibeOptions.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <button
          type="submit"
          disabled={loading || !title.trim()}
          className="sm:mb-0 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:bg-zinc-700 disabled:text-zinc-400 px-6 py-2.5 text-sm font-semibold text-white transition focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2 focus:ring-offset-zinc-900 cursor-pointer disabled:cursor-not-allowed whitespace-nowrap"
        >
          {loading ? "Adding…" : "Add Game"}
        </button>
      </div>

      {/* Full OST toggle */}
      <label className="flex items-center gap-3 cursor-pointer select-none w-fit">
        <button
          type="button"
          role="switch"
          aria-checked={allowFullOST}
          onClick={() => setAllowFullOST((v) => !v)}
          className={`relative inline-flex h-5 w-9 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 ${
            allowFullOST ? "bg-violet-600" : "bg-zinc-600"
          }`}
        >
          <span
            className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
              allowFullOST ? "translate-x-4" : "translate-x-0"
            }`}
          />
        </button>
        <div>
          <span className="text-sm font-medium text-zinc-300">Full OST</span>
          <p className="text-xs text-zinc-500">
            {allowFullOST
              ? "Will find one long compilation video for this game"
              : "Will find individual tracks (counts toward playlist total)"}
          </p>
        </div>
      </label>

      {error && (
        <p className="text-xs text-red-400">{error}</p>
      )}
    </form>
  );
}
