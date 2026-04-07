"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { CheckIcon, Spinner } from "@/components/Icons";
import { CurationMode } from "@/types";
import type { Game } from "@/types";

interface CatalogBrowserProps {
  libraryGameIds: Set<string>;
  onAdd: (game: Game, curation: CurationMode) => Promise<void>;
  searchFilter?: string;
  drawerExpanded: boolean;
}

const PAGE_SIZE = 20;
// Grid sizing constants — kept in sync with the inline grid style below.
const GRID_MIN_COL = 220;
const GRID_GAP = 12;
// Width delta the catalog grid gains/loses when the drawer collapses/expands
// (LibraryDrawer: 300px expanded vs 40px collapsed strip).
const DRAWER_WIDTH_DELTA = 260;
// Drawer width transition duration (DESIGN_SYSTEM.md §2 — 300ms panel open/close).
const DRAWER_TRANSITION_MS = 300;

export function CatalogBrowser({
  libraryGameIds,
  onAdd,
  searchFilter,
  drawerExpanded,
}: CatalogBrowserProps) {
  const [catalog, setCatalog] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const gridRef = useRef<HTMLDivElement>(null);
  // While the drawer transitions, lock the grid to a fixed column count so the
  // smoothly-animating container width interpolates each card's width via 1fr,
  // instead of letting `auto-fill` snap the column count mid-animation.
  const [lockedCols, setLockedCols] = useState<number | null>(null);
  const isFirstDrawerRender = useRef(true);

  useEffect(() => {
    if (isFirstDrawerRender.current) {
      isFirstDrawerRender.current = false;
      return;
    }
    const grid = gridRef.current;
    if (!grid) return;
    // Predict end-state column count from the post-transition container width.
    const currentWidth = grid.clientWidth;
    const targetWidth = currentWidth + (drawerExpanded ? -DRAWER_WIDTH_DELTA : DRAWER_WIDTH_DELTA);
    const cols = Math.max(1, Math.floor((targetWidth + GRID_GAP) / (GRID_MIN_COL + GRID_GAP)));
    setLockedCols(cols);
    const t = window.setTimeout(() => setLockedCols(null), DRAWER_TRANSITION_MS + 20);
    return () => window.clearTimeout(t);
  }, [drawerExpanded]);

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
            ref={gridRef}
            className="grid gap-3"
            style={{
              gridTemplateColumns:
                lockedCols !== null
                  ? `repeat(${lockedCols}, minmax(0, 1fr))`
                  : "repeat(auto-fill, minmax(220px, 1fr))",
            }}
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
        <p className="text-foreground line-clamp-2 text-xs leading-snug font-medium">
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
            <button
              onClick={() => onAdd(CurationMode.Include)}
              className="bg-primary/80 text-primary-foreground w-full cursor-pointer rounded-lg px-2 py-1 text-[11px] font-medium transition-colors hover:bg-[var(--primary-hover)]"
            >
              + Add
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
