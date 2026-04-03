"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { usePlayerContext } from "@/context/player-context";
import { CatalogBrowser } from "@/components/CatalogBrowser";
import { CatalogHeaderBar } from "@/components/CatalogHeaderBar";
import { LibraryDrawer } from "@/components/LibraryDrawer";
import type { CurationMode } from "@/types";

const LS_DRAWER_OPENED = "bgm_drawer_opened";

export function CatalogClient() {
  const router = useRouter();
  const { gameLibrary, config, playlist } = usePlayerContext();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [hasAutoOpened, setHasAutoOpened] = useState(
    () => typeof window !== "undefined" && localStorage.getItem(LS_DRAWER_OPENED) === "1",
  );

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
        />
        <CatalogBrowser
          libraryGameIds={libraryGameIds}
          onGameAdded={handleGameAdded}
          searchFilter={search}
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
