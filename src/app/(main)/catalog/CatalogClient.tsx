"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { usePlayerContext } from "@/context/player-context";
import { CatalogBrowser } from "@/components/library/CatalogBrowser";
import { CatalogHeaderBar } from "@/components/library/CatalogHeaderBar";
import { LibraryDrawer } from "@/components/library/LibraryDrawer";
import type { CurationMode, Game } from "@/types";

export function CatalogClient() {
  const router = useRouter();
  const { gameLibrary } = usePlayerContext();
  const [search, setSearch] = useState("");
  // null = not yet manually overridden; derive from library state below.
  const [drawerOverride, setDrawerOverride] = useState<boolean | null>(null);
  const drawerExpanded = drawerOverride ?? (!gameLibrary.isLoading && gameLibrary.games.length > 0);

  async function handleAdd(game: Game, curation: CurationMode) {
    const wasEmpty = gameLibrary.games.length === 0;
    await gameLibrary.addGame(game, curation);
    if (wasEmpty) setDrawerOverride(true);
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

  function handleCurate() {
    router.push("/");
  }

  const libraryGameIds = new Set(gameLibrary.games.map((g) => g.id));

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)]">
      {/* Left: catalog area */}
      <div className="flex min-w-0 flex-1 flex-col gap-3 p-4">
        <CatalogHeaderBar search={search} onSearchChange={setSearch} />
        <CatalogBrowser
          libraryGameIds={libraryGameIds}
          onAdd={handleAdd}
          searchFilter={search}
          drawerExpanded={drawerExpanded}
        />
      </div>

      {/* Right: library drawer */}
      <LibraryDrawer
        games={gameLibrary.games}
        isExpanded={drawerExpanded}
        onExpandedChange={setDrawerOverride}
        onCurationChange={handleCurationChange}
        onRemove={handleRemove}
        onCurate={handleCurate}
      />
    </div>
  );
}
