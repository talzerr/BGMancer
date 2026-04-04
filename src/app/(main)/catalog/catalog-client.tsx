"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { usePlayerContext } from "@/context/player-context";
import { CatalogBrowser } from "@/components/CatalogBrowser";
import { CatalogHeaderBar, FilterMode } from "@/components/CatalogHeaderBar";
import { LibraryDrawer } from "@/components/LibraryDrawer";
import type { CurationMode, Game } from "@/types";

export function CatalogClient() {
  const router = useRouter();
  const { gameLibrary, config, playlist, isSignedIn } = usePlayerContext();
  const [search, setSearch] = useState("");
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [filterMode, setFilterMode] = useState<FilterMode>(FilterMode.All);

  useEffect(() => {
    if (!isSignedIn) return;
    fetch("/api/favorites")
      .then((r) => (r.ok ? (r.json() as Promise<string[]>) : []))
      .then((ids) => setFavoriteIds(new Set(ids)));
  }, [isSignedIn]);

  async function handleToggleFavorite(gameId: string) {
    setFavoriteIds((prev) => {
      const next = new Set(prev);
      if (next.has(gameId)) next.delete(gameId);
      else next.add(gameId);
      return next;
    });
    if (isSignedIn) {
      try {
        const res = await fetch("/api/favorites", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ gameId }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
      } catch {
        // Revert optimistic update
        setFavoriteIds((prev) => {
          const reverted = new Set(prev);
          if (reverted.has(gameId)) reverted.delete(gameId);
          else reverted.add(gameId);
          return reverted;
        });
      }
    }
  }

  async function handleAdd(game: Game, curation: CurationMode) {
    await gameLibrary.addGame(game, curation);
  }

  async function handleCurationChange(gameId: string, curation: CurationMode) {
    try {
      await gameLibrary.updateCuration(gameId, curation);
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
    <div className="flex min-h-[calc(100vh-3.5rem)]">
      {/* Left: catalog area */}
      <div className="flex min-w-0 flex-1 flex-col gap-3 p-4">
        <CatalogHeaderBar
          search={search}
          onSearchChange={setSearch}
          favoriteCount={isSignedIn ? favoriteIds.size : 0}
          filterMode={filterMode}
          onFilterChange={setFilterMode}
        />
        <CatalogBrowser
          libraryGameIds={libraryGameIds}
          onAdd={handleAdd}
          searchFilter={search}
          favoriteGameIds={isSignedIn ? favoriteIds : undefined}
          onToggleFavorite={isSignedIn ? handleToggleFavorite : undefined}
          showFavoritesOnly={isSignedIn && filterMode === FilterMode.Favorites}
        />
      </div>

      {/* Right: library drawer */}
      <LibraryDrawer
        games={gameLibrary.games}
        targetTrackCount={config.targetTrackCount}
        generating={playlist.generating}
        onCurationChange={handleCurationChange}
        onRemove={handleRemove}
        onGenerate={handleGenerate}
      />
    </div>
  );
}
