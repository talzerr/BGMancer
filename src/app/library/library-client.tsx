"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Game } from "@/types";
import { Spinner, SearchIcon, CheckIcon } from "@/components/Icons";
import { AddGameForm } from "@/components/AddGameForm";
import { GameRow } from "@/components/GameRow";
import { SteamImportPanel } from "@/components/SteamImportPanel";
import { SeedExportPanel } from "@/components/SeedExportPanel";

type Filter = "all" | "active" | "disabled";
type SortKey = "playtime" | "name" | "added";

const PAGE_SIZE_OPTIONS = [15, 25, 50, 100] as const;
type PageSize = (typeof PAGE_SIZE_OPTIONS)[number];

export function LibraryClient() {
  const [games, setGames] = useState<Game[]>([]);
  const [ytCache, setYtCache] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<SortKey>("playtime");
  const [search, setSearch] = useState("");
  const [enablingAll, setEnablingAll] = useState(false);
  const [pageSize, setPageSize] = useState<PageSize>(25);
  const [page, setPage] = useState(0);

  const fetchGames = useCallback(async () => {
    try {
      const [gamesRes, cacheRes] = await Promise.all([
        fetch("/api/games?includeDisabled=true"),
        fetch("/api/yt-cache"),
      ]);
      if (gamesRes.ok) setGames(await gamesRes.json());
      if (cacheRes.ok) setYtCache(await cacheRes.json());
    } catch (err) {
      console.error("Failed to fetch games:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGames();
  }, [fetchGames]);

  async function handleToggle(id: string, enabled: boolean) {
    setGames((prev) => prev.map((g) => (g.id === id ? { ...g, enabled } : g)));
    try {
      await fetch(`/api/games?id=${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      });
    } catch {
      setGames((prev) => prev.map((g) => (g.id === id ? { ...g, enabled: !enabled } : g)));
    }
  }

  async function handlePlaylistChange(gameId: string, playlistId: string | null) {
    const prev = ytCache[gameId] ?? null;
    if (playlistId) {
      setYtCache((c) => ({ ...c, [gameId]: playlistId }));
      try {
        await fetch("/api/yt-cache", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ game_id: gameId, playlist_id: playlistId }),
        });
      } catch {
        setYtCache((c) => {
          const next = { ...c };
          if (prev) next[gameId] = prev;
          else delete next[gameId];
          return next;
        });
      }
    } else {
      setYtCache((c) => {
        const next = { ...c };
        delete next[gameId];
        return next;
      });
      try {
        await fetch(`/api/yt-cache?game_id=${gameId}`, { method: "DELETE" });
      } catch {
        setYtCache((c) => (prev ? { ...c, [gameId]: prev } : c));
      }
    }
  }

  async function handleDelete(id: string) {
    try {
      const res = await fetch(`/api/games?id=${id}`, { method: "DELETE" });
      if (res.ok) setGames((prev) => prev.filter((g) => g.id !== id));
    } catch (err) {
      console.error("Failed to delete game:", err);
    }
  }

  const activeCount = games.filter((g) => g.enabled).length;
  const disabledCount = games.filter((g) => !g.enabled).length;

  const displayed = useMemo(() => {
    let list = [...games];

    if (filter === "active") list = list.filter((g) => g.enabled);
    else if (filter === "disabled") list = list.filter((g) => !g.enabled);

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((g) => g.title.toLowerCase().includes(q));
    }

    if (sort === "name") {
      list.sort((a, b) => a.title.localeCompare(b.title));
    } else if (sort === "playtime") {
      list.sort((a, b) => (b.playtime_minutes ?? -1) - (a.playtime_minutes ?? -1));
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

  async function handleEnableAllShown() {
    const toEnable = displayed.filter((g) => !g.enabled);
    if (toEnable.length === 0) return;
    setEnablingAll(true);
    const ids = new Set(toEnable.map((g) => g.id));
    setGames((prev) => prev.map((g) => (ids.has(g.id) ? { ...g, enabled: true } : g)));
    await Promise.all(
      toEnable.map((g) =>
        fetch(`/api/games?id=${g.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ enabled: true }),
        }),
      ),
    );
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
            <h1 className="text-xl font-bold text-white">Game Library</h1>
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold text-white tabular-nums">{activeCount}</p>
            <p className="text-xs text-zinc-500">active</p>
          </div>
        </div>

        {/* Two-column layout */}
        <div className="flex flex-col items-start gap-6 lg:grid lg:grid-cols-[300px_1fr]">
          {/* Sidebar */}
          <aside className="flex flex-col gap-4 lg:sticky lg:top-8">
            <section className="relative z-10 rounded-2xl border border-white/[0.07] bg-zinc-900/70 p-5 shadow-lg shadow-black/40 backdrop-blur-sm">
              <h2 className="mb-4 text-[11px] font-bold tracking-widest text-zinc-500 uppercase">
                Add a Game
              </h2>
              <AddGameForm
                onGameAdded={() => {
                  fetchGames();
                }}
              />
            </section>
            <SteamImportPanel onImported={fetchGames} />
            <SeedExportPanel />
          </aside>

          {/* Main: game list */}
          <div className="flex min-w-0 flex-col gap-4">
            {/* Filter + sort + search */}
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-2">
                {(
                  [
                    { key: "all" as Filter, label: `All (${games.length})` },
                    { key: "active" as Filter, label: `Active (${activeCount})` },
                    { key: "disabled" as Filter, label: `Disabled (${disabledCount})` },
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

                {displayed.some((g) => !g.enabled) && (
                  <button
                    onClick={handleEnableAllShown}
                    disabled={enablingAll}
                    className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-teal-500/30 bg-teal-600/20 px-3 py-1.5 text-xs font-semibold text-teal-300 transition-colors hover:bg-teal-600/30 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {enablingAll ? (
                      <Spinner className="h-3 w-3" />
                    ) : (
                      <CheckIcon className="h-3 w-3" />
                    )}
                    Enable all shown ({displayed.filter((g) => !g.enabled).length})
                  </button>
                )}

                <div className="ml-auto flex items-center gap-2">
                  <span className="text-xs text-zinc-500">Sort:</span>
                  {(
                    [
                      { key: "added" as SortKey, label: "Added" },
                      { key: "playtime" as SortKey, label: "Playtime" },
                      { key: "name" as SortKey, label: "Name" },
                    ] as const
                  ).map(({ key, label }) => (
                    <button
                      key={key}
                      onClick={() => setSort(key)}
                      className={`cursor-pointer rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                        sort === key
                          ? "bg-zinc-700 text-white"
                          : "text-zinc-500 hover:text-zinc-300"
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
                  className="w-full rounded-lg border border-white/[0.07] bg-zinc-800/60 py-2.5 pr-4 pl-9 text-sm text-white placeholder-zinc-500 focus:ring-2 focus:ring-teal-500/40 focus:outline-none"
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
                      Add a game using the panel on the left, or import from Steam.
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
                    ytPlaylistId={ytCache[game.id] ?? null}
                    onToggle={handleToggle}
                    onDelete={handleDelete}
                    onPlaylistChange={handlePlaylistChange}
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
                No active games — enable at least one to generate a playlist.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
