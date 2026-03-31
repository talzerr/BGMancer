"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CurationMode } from "@/types";
import type { Game } from "@/types";
import { Spinner, SearchIcon, CheckIcon, ChevronDownIcon, ChevronUpIcon } from "@/components/Icons";
import { GameRow, CurationLegend } from "@/components/GameRow";
import { CatalogBrowser } from "@/components/CatalogBrowser";
import { usePlayerContext } from "@/context/player-context";
type Filter = "all" | "skip" | "lite" | "include" | "focus";
type SortKey = "name" | "added";

const PAGE_SIZE_OPTIONS = [15, 25, 50, 100] as const;
type PageSize = (typeof PAGE_SIZE_OPTIONS)[number];

export function LibraryClient() {
  const { gameLibrary } = usePlayerContext();
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<SortKey>("name");
  const [search, setSearch] = useState("");
  const [enablingAll, setEnablingAll] = useState(false);
  const [pageSize, setPageSize] = useState<PageSize>(25);
  const [page, setPage] = useState(0);
  const [catalogOpen, setCatalogOpen] = useState(false);

  const fetchGames = useCallback(async () => {
    try {
      const res = await fetch("/api/games?includeDisabled=true");
      if (res.ok) setGames(await res.json());
    } catch (err) {
      console.error("Failed to fetch games:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGames();
  }, [fetchGames]);

  // Auto-expand catalog when library is empty
  useEffect(() => {
    if (!loading && games.length === 0) setCatalogOpen(true);
  }, [loading, games.length]);

  async function handleCurationChange(id: string, newCuration: CurationMode) {
    const prevCuration = games.find((g) => g.id === id)?.curation;
    setGames((list) => list.map((g) => (g.id === id ? { ...g, curation: newCuration } : g)));
    try {
      await fetch(`/api/games?id=${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ curation: newCuration }),
      });
      gameLibrary.fetchGames();
    } catch {
      if (prevCuration !== undefined) {
        setGames((list) => list.map((g) => (g.id === id ? { ...g, curation: prevCuration } : g)));
      }
    }
  }

  async function handleDelete(id: string) {
    try {
      const res = await fetch(`/api/games?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        setGames((prev) => prev.filter((g) => g.id !== id));
        gameLibrary.fetchGames();
      }
    } catch (err) {
      console.error("Failed to delete game:", err);
    }
  }

  const activeCount = games.filter((g) => g.curation !== CurationMode.Skip).length;
  const skipCount = games.filter((g) => g.curation === CurationMode.Skip).length;
  const liteCount = games.filter((g) => g.curation === CurationMode.Lite).length;
  const includeCount = games.filter((g) => g.curation === CurationMode.Include).length;
  const focusCount = games.filter((g) => g.curation === CurationMode.Focus).length;

  const displayed = useMemo(() => {
    let list = [...games];

    if (filter === CurationMode.Skip) list = list.filter((g) => g.curation === CurationMode.Skip);
    else if (filter === CurationMode.Lite)
      list = list.filter((g) => g.curation === CurationMode.Lite);
    else if (filter === CurationMode.Include)
      list = list.filter((g) => g.curation === CurationMode.Include);
    else if (filter === CurationMode.Focus)
      list = list.filter((g) => g.curation === CurationMode.Focus);

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((g) => g.title.toLowerCase().includes(q));
    }

    if (sort === "name") {
      list.sort((a, b) => a.title.localeCompare(b.title));
    }
    // "added" keeps the default server order (created_at ASC)

    return list;
  }, [games, filter, sort, search]);

  // Reset to first page whenever the filtered/sorted list changes
  useEffect(() => {
    setPage(0);
  }, [filter, sort, search, pageSize]);

  const totalPages = Math.ceil(displayed.length / pageSize);
  const pageStart = page * pageSize;
  const paginatedDisplayed = displayed.slice(pageStart, pageStart + pageSize);

  async function handleIncludeAllShown() {
    const toInclude = displayed.filter((g) => g.curation === CurationMode.Skip);
    if (toInclude.length === 0) return;
    setEnablingAll(true);
    const ids = new Set(toInclude.map((g) => g.id));
    setGames((list) =>
      list.map((g) => (ids.has(g.id) ? { ...g, curation: CurationMode.Include } : g)),
    );
    await Promise.all(
      toInclude.map((g) =>
        fetch(`/api/games?id=${g.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ curation: "include" }),
        }),
      ),
    );
    gameLibrary.fetchGames();
    setEnablingAll(false);
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="mx-auto max-w-6xl px-4 py-8">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <Link
              href="/"
              className="mb-2 inline-flex items-center gap-1 text-xs text-zinc-500 transition-colors hover:text-zinc-300"
            >
              ← BGMancer
            </Link>
            <h1 className="font-display text-xl font-bold text-white">Game Library</h1>
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold text-white tabular-nums">{activeCount}</p>
            <p className="text-xs text-zinc-500">active</p>
          </div>
        </div>

        {/* Collapsible catalog section */}
        <section className="mb-6 rounded-2xl border border-white/[0.07] bg-zinc-900/70 shadow-lg shadow-black/40 backdrop-blur-sm">
          <button
            onClick={() => setCatalogOpen((v) => !v)}
            className="flex w-full cursor-pointer items-center justify-between px-5 py-4"
          >
            <h2 className="font-display text-[11px] font-bold tracking-widest text-zinc-500 uppercase">
              Browse Catalog
            </h2>
            {catalogOpen ? (
              <ChevronUpIcon className="h-4 w-4 text-zinc-500" />
            ) : (
              <ChevronDownIcon className="h-4 w-4 text-zinc-500" />
            )}
          </button>
          {catalogOpen && (
            <div className="px-5 pb-5">
              <CatalogBrowser
                libraryGameIds={new Set(games.map((g) => g.id))}
                onGameAdded={() => {
                  fetchGames();
                  gameLibrary.fetchGames();
                }}
              />
            </div>
          )}
        </section>

        {/* Library list */}
        <div className="flex min-w-0 flex-col gap-4">
          {/* Filter + sort + search */}
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              {(
                [
                  { key: "all" as Filter, label: `All (${games.length})` },
                  { key: "focus" as Filter, label: `Focus (${focusCount})` },
                  { key: "include" as Filter, label: `Include (${includeCount})` },
                  { key: "lite" as Filter, label: `Lite (${liteCount})` },
                  { key: "skip" as Filter, label: `Skip (${skipCount})` },
                ] as const
              ).map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setFilter(key)}
                  className={`cursor-pointer rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                    filter === key
                      ? "bg-zinc-700 text-white"
                      : "border border-white/[0.07] bg-zinc-900/60 text-zinc-400 hover:text-white"
                  }`}
                >
                  {label}
                </button>
              ))}

              <CurationLegend />

              {displayed.some((g) => g.curation === CurationMode.Skip) && (
                <button
                  onClick={handleIncludeAllShown}
                  disabled={enablingAll}
                  className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-violet-500/30 bg-violet-600/20 px-3 py-1.5 text-xs font-semibold text-violet-300 transition-colors hover:bg-violet-600/30 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {enablingAll ? (
                    <Spinner className="h-3 w-3" />
                  ) : (
                    <CheckIcon className="h-3 w-3" />
                  )}
                  Include all shown (
                  {displayed.filter((g) => g.curation === CurationMode.Skip).length})
                </button>
              )}

              <div className="ml-auto flex items-center gap-2">
                <span className="text-xs text-zinc-500">Sort:</span>
                {(
                  [
                    { key: "added" as SortKey, label: "Added" },
                    { key: "name" as SortKey, label: "Name" },
                  ] as const
                ).map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => setSort(key)}
                    className={`cursor-pointer rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                      sort === key ? "bg-zinc-700 text-white" : "text-zinc-500 hover:text-zinc-300"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="relative">
              <SearchIcon className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search games…"
                className="w-full rounded-lg border border-white/[0.07] bg-zinc-800/60 py-2.5 pr-4 pl-9 text-sm text-white placeholder-zinc-500 focus:ring-2 focus:ring-violet-500/40 focus:outline-none"
              />
            </div>
          </div>

          {/* Game list */}
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-[52px] animate-pulse rounded-xl bg-zinc-900/40" />
              ))}
            </div>
          ) : displayed.length === 0 ? (
            <div className="rounded-2xl border border-white/[0.07] bg-zinc-900/60 p-8 text-center">
              {games.length === 0 ? (
                <>
                  <p className="mb-1 text-sm text-zinc-400">No games in your library yet.</p>
                  <p className="text-xs text-zinc-600">
                    Browse the catalog above to add games to your library.
                  </p>
                </>
              ) : (
                <p className="text-sm text-zinc-500">No games match your filters.</p>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              {paginatedDisplayed.map((game) => (
                <GameRow
                  key={game.id}
                  game={game}
                  onCurationChange={handleCurationChange}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}

          {/* Pagination */}
          {!loading && displayed.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.05] pt-4">
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-zinc-600">Per page:</span>
                {PAGE_SIZE_OPTIONS.map((size) => (
                  <button
                    key={size}
                    onClick={() => setPageSize(size)}
                    className={`cursor-pointer rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors ${
                      pageSize === size
                        ? "bg-zinc-700 text-white"
                        : "text-zinc-500 hover:text-zinc-300"
                    }`}
                  >
                    {size}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-3">
                <span className="text-xs text-zinc-500 tabular-nums">
                  {pageStart + 1}–{Math.min(pageStart + pageSize, displayed.length)} of{" "}
                  {displayed.length}
                </span>
                <button
                  onClick={() => setPage((p) => p - 1)}
                  disabled={page === 0}
                  className="cursor-pointer rounded-lg border border-white/[0.06] px-3 py-1.5 text-xs font-semibold text-zinc-400 transition-colors hover:border-white/[0.12] hover:text-white disabled:cursor-default disabled:opacity-30"
                >
                  ← Prev
                </button>
                <button
                  onClick={() => setPage((p) => p + 1)}
                  disabled={page >= totalPages - 1}
                  className="cursor-pointer rounded-lg border border-white/[0.06] px-3 py-1.5 text-xs font-semibold text-zinc-400 transition-colors hover:border-white/[0.12] hover:text-white disabled:cursor-default disabled:opacity-30"
                >
                  Next →
                </button>
              </div>
            </div>
          )}

          {!loading && games.length > 0 && activeCount === 0 && (
            <p className="text-center text-xs text-zinc-600">
              All games are set to Skip — set at least one to Lite, Include, or Focus to generate a
              playlist.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
