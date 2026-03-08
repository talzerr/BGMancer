"use client";

import { useEffect, useRef, useState } from "react";
import type { SyntheticEvent } from "react";
import type { Game } from "@/types";
import { ErrorCircle, Spinner } from "@/components/Icons";

interface SteamResult {
  appid: number;
  name: string;
  tiny_image: string;
}

interface AddGameFormProps {
  onGameAdded: (game: Game) => void;
}

export function AddGameForm({ onGameAdded }: AddGameFormProps) {
  const [query, setQuery] = useState("");
  const [selectedAppid, setSelectedAppid] = useState<number | null>(null);
  const [results, setResults] = useState<SteamResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleQueryChange(value: string) {
    setQuery(value);
    setSelectedAppid(null);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (value.trim().length < 2) {
      setResults([]);
      setShowDropdown(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/steam/search?q=${encodeURIComponent(value.trim())}`);
        const data = (await res.json()) as { results?: SteamResult[] };
        setResults(data.results ?? []);
        setShowDropdown((data.results?.length ?? 0) > 0);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
  }

  function handleSelect(result: SteamResult) {
    setQuery(result.name);
    setSelectedAppid(result.appid);
    setResults([]);
    setShowDropdown(false);
  }

  async function handleSubmit(e: SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const body: Record<string, unknown> = { title: query.trim() };
      if (selectedAppid !== null) body.steam_appid = selectedAppid;

      const res = await fetch("/api/games", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to add game");
      }

      const game: Game = await res.json();
      onGameAdded(game);
      setQuery("");
      setSelectedAppid(null);
      setResults([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2.5">
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="game-title"
          className="text-[10px] font-semibold tracking-widest text-zinc-500 uppercase"
        >
          Game Title
        </label>

        <div ref={containerRef} className="relative">
          <input
            id="game-title"
            type="text"
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            onFocus={() => results.length > 0 && setShowDropdown(true)}
            onKeyDown={(e) => e.key === "Escape" && setShowDropdown(false)}
            placeholder="Search Steam or type any game…"
            disabled={loading}
            autoComplete="off"
            className="w-full rounded-lg border border-white/[0.07] bg-zinc-800/80 px-3.5 py-2.5 pr-8 text-sm text-white placeholder-zinc-500 focus:border-violet-500/50 focus:ring-2 focus:ring-violet-500/50 focus:outline-none disabled:opacity-50"
          />

          {/* Search spinner / Steam badge */}
          <div className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2">
            {searching ? (
              <Spinner className="h-3.5 w-3.5 text-zinc-500" />
            ) : selectedAppid !== null ? (
              <svg className="h-3.5 w-3.5 text-teal-400" viewBox="0 0 24 24" fill="currentColor">
                <path d="M11.979 0C5.678 0 .511 4.86.022 11.037l6.432 2.658c.545-.371 1.203-.59 1.912-.59.063 0 .125.004.188.006l2.861-4.142V8.91c0-2.495 2.028-4.524 4.524-4.524 2.494 0 4.524 2.031 4.524 4.527s-2.03 4.525-4.524 4.525h-.105l-4.076 2.911c0 .052.004.105.004.159 0 1.875-1.515 3.396-3.39 3.396-1.635 0-3.016-1.173-3.331-2.727L.436 15.27C1.862 20.307 6.486 24 11.979 24c6.627 0 11.999-5.373 11.999-12S18.607 0 11.979 0z" />
              </svg>
            ) : null}
          </div>

          {/* Autocomplete dropdown */}
          {showDropdown && results.length > 0 && (
            <ul className="absolute top-full z-50 mt-1 w-full overflow-hidden rounded-xl border border-white/[0.10] bg-zinc-900 shadow-xl shadow-black/60">
              {results.map((r) => (
                <li key={r.appid}>
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleSelect(r);
                    }}
                    className="flex w-full cursor-pointer items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-white/[0.06]"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={r.tiny_image}
                      alt=""
                      width={40}
                      height={15}
                      className="h-[15px] w-10 shrink-0 rounded bg-zinc-800 object-cover"
                    />
                    <span className="truncate text-sm text-zinc-200">{r.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <button
        type="submit"
        disabled={loading || !query.trim()}
        className="w-full cursor-pointer rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-900/30 hover:bg-violet-500 focus:ring-2 focus:ring-violet-500/50 focus:outline-none disabled:cursor-not-allowed disabled:border disabled:border-white/[0.05] disabled:bg-zinc-800 disabled:text-zinc-600"
      >
        {loading ? "Adding…" : "Add Game"}
      </button>

      {error && (
        <p className="flex items-center gap-1.5 text-xs text-red-400">
          <ErrorCircle className="h-3 w-3 shrink-0" />
          {error}
        </p>
      )}
    </form>
  );
}
