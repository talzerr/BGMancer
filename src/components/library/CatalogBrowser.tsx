"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { CheckIcon, ChevronDownIcon, Spinner } from "@/components/Icons";
import { CurationMode } from "@/types";
import type { Game } from "@/types";

interface CatalogBrowserProps {
  libraryGameIds: Set<string>;
  onAdd: (game: Game, curation: CurationMode) => Promise<void>;
  searchFilter?: string;
}

const PAGE_SIZE = 20;

const CURATION_ADD_OPTIONS: {
  mode: CurationMode;
  label: string;
  colorClass: string;
}[] = [
  { mode: CurationMode.Focus, label: "Focus", colorClass: "text-primary" },
  { mode: CurationMode.Include, label: "Include", colorClass: "text-primary" },
  { mode: CurationMode.Lite, label: "Lite", colorClass: "text-primary" },
];

export function CatalogBrowser({ libraryGameIds, onAdd, searchFilter }: CatalogBrowserProps) {
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
  }, [fetchCatalog]);

  // Reset visible count when filter changes
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [searchFilter]);

  const filtered = catalog.filter(
    (g) => !searchFilter?.trim() || g.title.toLowerCase().includes(searchFilter.toLowerCase()),
  );

  const visible = filtered.slice(0, visibleCount);

  async function handleAdd(game: Game, curation: CurationMode = CurationMode.Include) {
    setAddingId(game.id);
    try {
      await onAdd(game, curation);
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
          <Spinner className="h-5 w-5 text-[var(--text-tertiary)]" />
        </div>
      ) : filtered.length === 0 ? (
        <p className="py-6 text-center text-xs text-[var(--text-disabled)]">
          {searchFilter?.trim() ? "No games match your search." : "No published games yet."}
        </p>
      ) : (
        <>
          <div
            className="grid gap-3"
            style={{ gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}
          >
            {visible.map((game) => {
              const inLibrary = libraryGameIds.has(game.id);
              const isAdding = addingId === game.id;
              return (
                <CatalogCard
                  key={game.id}
                  game={game}
                  inLibrary={inLibrary}
                  isAdding={isAdding}
                  onAdd={(curation) => handleAdd(game, curation)}
                />
              );
            })}
          </div>

          {visible.length < filtered.length && (
            <div className="flex justify-center pt-2">
              <button
                onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
                className="border-border bg-secondary/60 text-muted-foreground hover:text-foreground cursor-pointer rounded-lg border px-4 py-2 text-xs font-medium transition-colors hover:border-[var(--border-emphasis)]"
              >
                Show more
              </button>
            </div>
          )}
        </>
      )}

      <p className="text-[10px] text-[var(--text-disabled)]">
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
  onAdd,
}: {
  game: Game;
  inLibrary: boolean;
  isAdding: boolean;
  onAdd: (curation: CurationMode) => void;
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
          ? "border-primary/20 bg-primary/5"
          : "border-border bg-secondary/60 hover:border-[var(--border-emphasis)]"
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
            className="bg-secondary aspect-[460/215] w-full object-cover"
            sizes="(min-width: 1280px) 280px, (min-width: 768px) 33vw, 50vw"
            loading="lazy"
            unoptimized
          />
        ) : (
          <div className="bg-secondary/80 flex aspect-[460/215] w-full items-center justify-center">
            <span className="text-xs font-medium text-[var(--text-disabled)]">BGM</span>
          </div>
        )}
      </div>

      {/* Title + action */}
      <div className="flex flex-1 flex-col gap-2 p-2.5">
        <p className="font-display text-foreground line-clamp-2 text-xs leading-snug font-medium">
          {game.title}
        </p>

        <div className="mt-auto">
          {inLibrary ? (
            <span className="flex items-center gap-1 text-[11px] text-[var(--text-tertiary)]">
              <CheckIcon className="h-3 w-3" />
              In library
            </span>
          ) : isAdding ? (
            <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-tertiary)]">
              <Spinner className="h-3 w-3" />
              Adding…
            </div>
          ) : (
            <div ref={dropdownRef} className="relative">
              <div className="flex overflow-hidden rounded-lg">
                <button
                  onClick={() => onAdd(CurationMode.Include)}
                  className="bg-primary/80 text-primary-foreground flex-1 cursor-pointer px-2 py-1 text-[11px] font-medium transition-colors hover:bg-[var(--primary-hover)]"
                >
                  + Add
                </button>
                <button
                  onClick={() => setDropdownOpen((v) => !v)}
                  className="bg-primary/80 text-primary-foreground cursor-pointer border-l border-[var(--primary-muted)]/60 px-1.5 py-1 transition-colors hover:bg-[var(--primary-hover)]"
                >
                  <ChevronDownIcon className="h-3 w-3" />
                </button>
              </div>

              {dropdownOpen && (
                <div className="bg-secondary absolute right-0 bottom-full z-30 mb-1 w-full min-w-[120px] overflow-hidden rounded-lg border border-[var(--border-emphasis)]">
                  <p className="px-2.5 py-1.5 text-[10px] font-medium tracking-wider text-[var(--text-tertiary)] uppercase">
                    Add as…
                  </p>
                  {CURATION_ADD_OPTIONS.map(({ mode, label, colorClass }) => (
                    <button
                      key={mode}
                      onClick={() => {
                        setDropdownOpen(false);
                        onAdd(mode);
                      }}
                      className={`hover:bg-accent flex w-full cursor-pointer items-center px-2.5 py-1.5 text-left text-xs font-medium transition-colors ${colorClass}`}
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
