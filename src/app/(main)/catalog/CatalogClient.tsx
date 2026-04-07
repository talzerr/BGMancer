"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { usePlayerContext } from "@/context/player-context";
import { useSteamLibrary } from "@/hooks/library/useSteamLibrary";
import { CatalogBrowser } from "@/components/library/CatalogBrowser";
import { CatalogHeaderBar } from "@/components/library/CatalogHeaderBar";
import { LibraryDrawer } from "@/components/library/LibraryDrawer";
import { SteamConnectDialog } from "@/components/library/SteamConnectDialog";
import type { CurationMode, Game } from "@/types";

export function CatalogClient() {
  const router = useRouter();
  const { gameLibrary, isSignedIn } = usePlayerContext();
  const steamLib = useSteamLibrary(isSignedIn);
  const [search, setSearch] = useState("");
  // null = not yet manually overridden; derive from library state below.
  const [drawerOverride, setDrawerOverride] = useState<boolean | null>(null);
  const drawerExpanded = drawerOverride ?? (!gameLibrary.isLoading && gameLibrary.games.length > 0);

  const [steamFilterOn, setSteamFilterOn] = useState(false);
  const [connectDialogOpen, setConnectDialogOpen] = useState(false);

  // Cooldown minutes are derived from the current steam error message — when the
  // server rejects a sync attempt with a 429, the error string contains
  // "Try again in N minutes". When the error clears, the cooldown clears.
  const steamCooldownMinutes = useMemo<number | null>(() => {
    if (!steamLib.error) return null;
    const match = steamLib.error.match(/Try again in (\d+) minutes?/);
    return match ? parseInt(match[1], 10) : null;
  }, [steamLib.error]);

  async function handleSteamSync(steamUrl?: string): Promise<boolean> {
    return await steamLib.sync(steamUrl);
  }

  async function handleSteamSyncFromPopover(): Promise<boolean> {
    return await handleSteamSync();
  }

  async function handleSteamDisconnect(): Promise<boolean> {
    const ok = await steamLib.disconnect();
    if (ok) {
      setSteamFilterOn(false);
    }
    return ok;
  }

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
        <CatalogHeaderBar
          search={search}
          onSearchChange={setSearch}
          isSignedIn={isSignedIn}
          steamLinked={steamLib.linked}
          steamFilterOn={steamFilterOn}
          onSteamFilterToggle={() => setSteamFilterOn((s) => !s)}
          onConnectSteamClick={() => setConnectDialogOpen(true)}
          steamSyncedAt={steamLib.steamSyncedAt}
          onSteamSync={handleSteamSyncFromPopover}
          onSteamDisconnect={handleSteamDisconnect}
          steamIsSyncing={steamLib.isSyncing}
          steamCooldownMinutes={steamCooldownMinutes}
        />
        <CatalogBrowser
          libraryGameIds={libraryGameIds}
          onAdd={handleAdd}
          searchFilter={search}
          drawerExpanded={drawerExpanded}
          steamFilterOn={steamFilterOn}
          steamMatchedGameIds={steamLib.matchedGameIds}
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

      <SteamConnectDialog
        open={connectDialogOpen}
        onOpenChange={setConnectDialogOpen}
        onSync={handleSteamSync}
        isSyncing={steamLib.isSyncing}
        error={steamLib.error}
      />
    </div>
  );
}
