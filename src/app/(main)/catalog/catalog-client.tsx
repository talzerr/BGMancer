"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { usePlayerContext } from "@/context/player-context";
import { CatalogBrowser } from "@/components/CatalogBrowser";
import { CatalogHeaderBar, FilterMode } from "@/components/CatalogHeaderBar";
import { LibraryDrawer } from "@/components/LibraryDrawer";
import type { CurationMode } from "@/types";

const LS_DRAWER_OPENED = "bgm_drawer_opened";

export function CatalogClient() {
  const router = useRouter();
  const { gameLibrary, config, playlist } = usePlayerContext();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [filterMode, setFilterMode] = useState<FilterMode>(FilterMode.All);
  const [hasAutoOpened, setHasAutoOpened] = useState(
    () => typeof window !== "undefined" && localStorage.getItem(LS_DRAWER_OPENED) === "1",
  );

  useEffect(() => {
    fetch("/api/favorites")
      .then((r) => (r.ok ? (r.json() as Promise<string[]>) : []))
      .then((ids) => setFavoriteIds(new Set(ids)));
  }, []);

  async function handleToggleFavorite(gameId: string) {
    setFavoriteIds((prev) => {
      const next = new Set(prev);
      if (next.has(gameId)) next.delete(gameId);
      else next.add(gameId);
      return next;
    });
    fetch("/api/favorites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gameId }),
    });
  }

  function handleGameAdded() {
    if (!hasAutoOpened) {
      setDrawerOpen(true);
      setHasAutoOpened(true);
      localStorage.setItem(LS_DRAWER_OPENED, "1");
    }
    gameLibrary.fetchGames();
  }

  async function handleCurationChange(gameId: string, curation: CurationMode) {
    try {
      await fetch(`/api/games?id=${gameId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ curation }),
      });
      gameLibrary.fetchGames();
    } catch (err) {
      console.error("Failed to update curation:", err);
    }
  }

  function handleRemove(gameId: string) {
    gameLibrary.deleteGame(gameId);
  }

  function handleGenerate() {
    router.push("/");
  }

  const libraryGameIds = new Set(gameLibrary.games.map((g) => g.id));

  return (
    <div className="flex min-h-[calc(100vh-3rem)]">
      {/* Left: catalog area */}
      <div className="flex min-w-0 flex-1 flex-col gap-3 p-4">
        <CatalogHeaderBar
          search={search}
          onSearchChange={setSearch}
          libraryGames={gameLibrary.games}
          drawerOpen={drawerOpen}
          onToggleDrawer={() => setDrawerOpen((v) => !v)}
          favoriteCount={favoriteIds.size}
          filterMode={filterMode}
          onFilterChange={setFilterMode}
        />
        <CatalogBrowser
          libraryGameIds={libraryGameIds}
          onGameAdded={handleGameAdded}
          searchFilter={search}
          favoriteGameIds={favoriteIds}
          onToggleFavorite={handleToggleFavorite}
          showFavoritesOnly={filterMode === FilterMode.Favorites}
        />
      </div>

      {/* Right: library drawer */}
      <LibraryDrawer
        open={drawerOpen}
        games={gameLibrary.games}
        totalTracks={playlist.tracks.length}
        targetTrackCount={config.targetTrackCount}
        generating={playlist.generating}
        onClose={() => setDrawerOpen(false)}
        onCurationChange={handleCurationChange}
        onRemove={handleRemove}
        onGenerate={handleGenerate}
      />
    </div>
  );
}
