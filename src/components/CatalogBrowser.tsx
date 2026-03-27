"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { SearchIcon, CheckIcon, ChevronDownIcon, Spinner } from "@/components/Icons";
import { CurationMode } from "@/types";
import type { Game } from "@/types";

interface CatalogBrowserProps {
  libraryGameIds: Set<string>;
  onGameAdded: () => void;
}

const CURATION_ADD_OPTIONS: {
  mode: CurationMode;
  label: string;
  colorClass: string;
}[] = [
  { mode: CurationMode.Focus, label: "Focus", colorClass: "text-amber-300" },
  { mode: CurationMode.Include, label: "Include", colorClass: "text-teal-300" },
  { mode: CurationMode.Lite, label: "Lite", colorClass: "text-blue-300" },
];

export function CatalogBrowser({ libraryGameIds, onGameAdded }: CatalogBrowserProps) {
  const [catalog, setCatalog] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [addingId, setAddingId] = useState<string | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchCatalog = useCallback(async (query?: string) => {
    try {
      const params = query?.trim() ? `?q=${encodeURIComponent(query.trim())}` : "";
      const res = await fetch(`/api/games/catalog${params}`);
      if (res.ok) setCatalog(await res.json());
    } catch {
      /* non-critical */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    Promise.resolve().then(() => fetchCatalog());
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function handleSearch(value: string) {
    setSearch(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchCatalog(value), 300);
  }

  async function handleAdd(gameId: string, curation: CurationMode = CurationMode.Include) {
    setAddingId(gameId);
    try {
      const res = await fetch("/api/games", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameId, curation }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      onGameAdded();
    } catch (err) {
      console.error("[CatalogBrowser] add failed:", err);
    } finally {
      setAddingId(null);
    }
  }

  return (
    <div className="space-y-3">
      {/* Search */}
      <div className="relative">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
        <input
          type="text"
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Search catalog..."
          className="w-full rounded-lg border border-white/[0.07] bg-zinc-800/60 py-2 pr-3 pl-9 text-sm text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-white/[0.12]"
        />
      </div>

      {/* Game grid */}
      {loading ? (
        <div className="flex justify-center py-10">
          <Spinner className="h-5 w-5 text-zinc-500" />
        </div>
      ) : catalog.length === 0 ? (
        <p className="py-6 text-center text-xs text-zinc-600">
          {search ? "No games match your search." : "No published games yet."}
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {catalog.map((game) => {
            const inLibrary = libraryGameIds.has(game.id);
            const isAdding = addingId === game.id;
            return (
              <CatalogCard
                key={game.id}
                game={game}
                inLibrary={inLibrary}
                isAdding={isAdding}
                onAdd={handleAdd}
              />
            );
          })}
        </div>
      )}

      <p className="text-[10px] text-zinc-600">
        {catalog.length} game{catalog.length === 1 ? "" : "s"} in catalog
      </p>
    </div>
  );
}

function CatalogCard({
  game,
  inLibrary,
  isAdding,
  onAdd,
}: {
  game: Game;
  inLibrary: boolean;
  isAdding: boolean;
  onAdd: (gameId: string, curation: CurationMode) => void;
}) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!dropdownOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setDropdownOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [dropdownOpen]);

  return (
    <div
      className={`group relative flex flex-col overflow-hidden rounded-xl border transition-colors ${
        inLibrary
          ? "border-teal-500/30 bg-teal-950/10"
          : "border-white/[0.07] bg-zinc-900/60 hover:border-white/[0.12]"
      }`}
    >
      {/* Cover art */}
      {game.thumbnail_url ? (
        <Image
          src={game.thumbnail_url}
          alt={game.title}
          width={460}
          height={215}
          className="aspect-[460/215] w-full bg-zinc-800 object-cover"
          unoptimized
        />
      ) : (
        <div className="flex aspect-[460/215] w-full items-center justify-center bg-zinc-800/80">
          <span className="text-xs font-bold text-zinc-600">BGM</span>
        </div>
      )}

      {/* Title + action */}
      <div className="flex flex-1 flex-col gap-2 p-2.5">
        <p className="line-clamp-2 text-xs leading-snug font-medium text-zinc-200">{game.title}</p>

        <div className="mt-auto">
          {inLibrary ? (
            <span className="flex items-center gap-1 text-[11px] text-teal-500/80">
              <CheckIcon className="h-3 w-3" />
              In library
            </span>
          ) : isAdding ? (
            <div className="flex items-center gap-1.5 text-[11px] text-zinc-500">
              <Spinner className="h-3 w-3" />
              Adding…
            </div>
          ) : (
            <div ref={dropdownRef} className="relative">
              <div className="flex overflow-hidden rounded-lg">
                <button
                  onClick={() => onAdd(game.id, CurationMode.Include)}
                  className="flex-1 cursor-pointer bg-teal-600/80 px-2 py-1.5 text-[11px] font-semibold text-white transition-colors hover:bg-teal-500"
                >
                  + Add
                </button>
                <button
                  onClick={() => setDropdownOpen((v) => !v)}
                  className="cursor-pointer border-l border-teal-700/60 bg-teal-600/80 px-1.5 py-1.5 text-white transition-colors hover:bg-teal-500"
                >
                  <ChevronDownIcon className="h-3 w-3" />
                </button>
              </div>

              {dropdownOpen && (
                <div className="absolute right-0 bottom-full z-30 mb-1 w-full min-w-[120px] overflow-hidden rounded-lg border border-white/[0.1] bg-zinc-800 shadow-xl shadow-black/50">
                  <p className="px-2.5 py-1.5 text-[10px] font-semibold tracking-wider text-zinc-500 uppercase">
                    Add as…
                  </p>
                  {CURATION_ADD_OPTIONS.map(({ mode, label, colorClass }) => (
                    <button
                      key={mode}
                      onClick={() => {
                        setDropdownOpen(false);
                        onAdd(game.id, mode);
                      }}
                      className={`flex w-full cursor-pointer items-center px-2.5 py-1.5 text-left text-xs font-medium transition-colors hover:bg-white/[0.06] ${colorClass}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
