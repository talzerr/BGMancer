"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { usePlayerContext } from "@/context/player-context";
import { performSignOut } from "@/components/AuthButtons";
import { useSteamLibrary } from "@/hooks/library/useSteamLibrary";
import { CatalogBrowser } from "@/components/library/CatalogBrowser";
import { CatalogHeaderBar } from "@/components/library/CatalogHeaderBar";
import { CatalogSteamControls } from "@/components/library/CatalogSteamControls";
import { LibraryDrawer } from "@/components/library/LibraryDrawer";
import { PlayerPanel } from "@/components/player/PlayerPanel";
import { LogoLink } from "@/components/layout/LogoLink";
import type { CurationMode, Game } from "@/types";

interface CatalogClientProps {
  requestFormEnabled: boolean;
  turnstileSiteKey: string | undefined;
  userName: string | null;
}

export function CatalogClient({
  requestFormEnabled,
  turnstileSiteKey,
  userName,
}: CatalogClientProps) {
  const router = useRouter();
  const { gameLibrary, isSignedIn, playlist } = usePlayerContext();
  const steamLib = useSteamLibrary(isSignedIn);
  const [search, setSearch] = useState("");
  const [drawerOverride, setDrawerOverride] = useState<boolean | null>(null);
  const drawerExpanded = drawerOverride ?? (!gameLibrary.isLoading && gameLibrary.games.length > 0);

  const [steamFilterOn, setSteamFilterOn] = useState(false);

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
    <div className="flex h-screen flex-row overflow-hidden">
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex shrink-0 items-center justify-between px-4 pt-4 pb-3 sm:px-6">
          <LogoLink />
          <CatalogHeaderBar search={search} onSearchChange={setSearch}>
            {isSignedIn && (
              <CatalogSteamControls
                lib={steamLib}
                filterOn={steamFilterOn}
                onFilterToggle={() => setSteamFilterOn((s) => !s)}
                onDisconnected={() => setSteamFilterOn(false)}
              />
            )}
          </CatalogHeaderBar>
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto">
          <div className="p-4 pt-0">
            <CatalogBrowser
              libraryGameIds={libraryGameIds}
              onAdd={handleAdd}
              searchFilter={search}
              drawerExpanded={drawerExpanded}
              steamFilterOn={steamFilterOn}
              steamMatchedGameIds={steamLib.matchedGameIds}
              requestFormEnabled={requestFormEnabled}
              turnstileSiteKey={turnstileSiteKey}
            />
          </div>
        </main>
      </div>

      <LibraryDrawer
        games={gameLibrary.games}
        isExpanded={drawerExpanded}
        onExpandedChange={setDrawerOverride}
        onCurationChange={handleCurationChange}
        onRemove={handleRemove}
        onCurate={handleCurate}
        userName={userName}
        onSignIn={!userName ? () => signIn("google", { callbackUrl: "/catalog" }) : undefined}
        onSignOut={userName ? () => performSignOut() : undefined}
      />

      {playlist.tracks.length > 0 && (
        <div className="hidden lg:flex">
          <PlayerPanel />
        </div>
      )}
    </div>
  );
}
