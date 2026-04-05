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
  const { gameLibrary, config, playlist } = usePlayerContext();
  const [search, setSearch] = useState("");

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
        <CatalogHeaderBar search={search} onSearchChange={setSearch} />
        <CatalogBrowser libraryGameIds={libraryGameIds} onAdd={handleAdd} searchFilter={search} />
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
