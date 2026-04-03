"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { CheckIcon, ChevronDownIcon, Spinner } from "@/components/Icons";
import { CurationMode } from "@/types";
import type { Game } from "@/types";

interface CatalogBrowserProps {
  libraryGameIds: Set<string>;
  onGameAdded: () => void;
  searchFilter?: string;
  favoriteGameIds: Set<string>;
  onToggleFavorite: (gameId: string) => void;
  showFavoritesOnly?: boolean;
}

const PAGE_SIZE = 20;

const CURATION_ADD_OPTIONS: {
  mode: CurationMode;
  label: string;
  colorClass: string;
}[] = [
  { mode: CurationMode.Focus, label: "Focus", colorClass: "text-amber-300" },
  { mode: CurationMode.Include, label: "Include", colorClass: "text-violet-300" },
  { mode: CurationMode.Lite, label: "Lite", colorClass: "text-blue-300" },
];

export function CatalogBrowser({
  libraryGameIds,
  onGameAdded,
  searchFilter,
  favoriteGameIds,
  onToggleFavorite,
  showFavoritesOnly,
}: CatalogBrowserProps) {
  const [catalog, setCatalog] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const fetchCatalog = useCallback(async () => {
    try {
      const res = await fetch("/api/games/catalog");
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

  // Reset visible count when filter changes
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [searchFilter, showFavoritesOnly]);

  const filtered = catalog
    .filter((g) => !showFavoritesOnly || favoriteGameIds.has(g.id))
    .filter(
      (g) => !searchFilter?.trim() || g.title.toLowerCase().includes(searchFilter.toLowerCase()),
    );

  const visible = filtered.slice(0, visibleCount);

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
      {/* Game grid */}
      {loading ? (
        <div className="flex justify-center py-10">
          <Spinner className="h-5 w-5 text-zinc-500" />
        </div>
      ) : filtered.length === 0 ? (
        <p className="py-6 text-center text-xs text-zinc-600">
          {searchFilter?.trim() ? "No games match your search." : "No published games yet."}
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {visible.map((game) => {
              const inLibrary = libraryGameIds.has(game.id);
              const isAdding = addingId === game.id;
              return (
                <CatalogCard
                  key={game.id}
                  game={game}
                  inLibrary={inLibrary}
                  isAdding={isAdding}
                  isFavorite={favoriteGameIds.has(game.id)}
                  onAdd={handleAdd}
                  onToggleFavorite={onToggleFavorite}
                />
              );
            })}
          </div>

          {visible.length < filtered.length && (
            <div className="flex justify-center pt-2">
              <button
                onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
                className="cursor-pointer rounded-lg border border-white/[0.06] bg-zinc-900/60 px-4 py-2 text-xs font-semibold text-zinc-400 transition-colors hover:border-white/[0.12] hover:text-white"
              >
                Show more
              </button>
            </div>
          )}
        </>
      )}

      <p className="text-[10px] text-zinc-600">
        {searchFilter?.trim()
          ? `${filtered.length} of ${catalog.length} game${catalog.length === 1 ? "" : "s"}`
          : `${catalog.length} game${catalog.length === 1 ? "" : "s"} in catalog`}
      </p>
    </div>
  );
}

function CatalogCard({
  game,
  inLibrary,
  isAdding,
  isFavorite,
  onAdd,
  onToggleFavorite,
}: {
  game: Game;
  inLibrary: boolean;
  isAdding: boolean;
  isFavorite: boolean;
  onAdd: (gameId: string, curation: CurationMode) => void;
  onToggleFavorite: (gameId: string) => void;
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
          ? "border-violet-500/20 bg-violet-950/10"
          : "border-white/[0.06] bg-zinc-900/60 hover:border-white/[0.12]"
      }`}
    >
      {/* Cover art */}
      <div className="relative bg-gradient-to-bl from-black/30 via-transparent to-transparent">
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

        {/* Favorite star */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            const el = e.currentTarget;
            el.classList.add("star-animate");
            el.addEventListener("animationend", () => el.classList.remove("star-animate"), {
              once: true,
            });
            onToggleFavorite(game.id);
          }}
          className={`absolute top-2 right-2 z-10 cursor-pointer rounded-full p-1 transition-all duration-200 ${
            isFavorite
              ? "opacity-100 drop-shadow-[0_0_6px_rgba(251,191,36,0.4)]"
              : "opacity-0 group-hover:opacity-100"
          }`}
        >
          {isFavorite ? (
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-amber-400">
              <path
                fillRule="evenodd"
                d="M10.868 2.884c-.321-.772-1.415-.772-1.736 0l-1.83 4.401-4.753.381c-.833.067-1.171 1.107-.536 1.651l3.62 3.102-1.106 4.637c-.194.813.691 1.456 1.405 1.02L10 15.591l4.069 2.485c.713.436 1.598-.207 1.404-1.02l-1.106-4.637 3.62-3.102c.635-.544.297-1.584-.536-1.65l-4.752-.382-1.831-4.401z"
                clipRule="evenodd"
              />
            </svg>
          ) : (
            <svg
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className="h-4 w-4 text-white/50"
            >
              <path d="M10.868 2.884c-.321-.772-1.415-.772-1.736 0l-1.83 4.401-4.753.381c-.833.067-1.171 1.107-.536 1.651l3.62 3.102-1.106 4.637c-.194.813.691 1.456 1.405 1.02L10 15.591l4.069 2.485c.713.436 1.598-.207 1.404-1.02l-1.106-4.637 3.62-3.102c.635-.544.297-1.584-.536-1.65l-4.752-.382-1.831-4.401z" />
            </svg>
          )}
        </button>
      </div>

      {/* Title + action */}
      <div className="flex flex-1 flex-col gap-2 p-2.5">
        <p className="font-display line-clamp-2 text-xs leading-snug font-medium text-zinc-200">
          {game.title}
        </p>

        <div className="mt-auto">
          {inLibrary ? (
            <span className="flex items-center gap-1 text-[11px] text-violet-500/80">
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
                  className="flex-1 cursor-pointer bg-violet-600/80 px-2 py-1.5 text-[11px] font-semibold text-white transition-colors hover:bg-violet-500"
                >
                  + Add
                </button>
                <button
                  onClick={() => setDropdownOpen((v) => !v)}
                  className="cursor-pointer border-l border-violet-700/60 bg-violet-600/80 px-1.5 py-1.5 text-white transition-colors hover:bg-violet-500"
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
