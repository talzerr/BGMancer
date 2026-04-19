"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { usePlayerContext } from "@/context/player-context";
import { performSignOut } from "@/components/layout/AuthButtons";
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
  const [catalogTotal, setCatalogTotal] = useState<number | null>(null);
  const handleCatalogLoaded = useCallback((total: number) => setCatalogTotal(total), []);

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

  const libraryCount = gameLibrary.games.length;

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
          <div className="p-4 pt-0 pb-24 lg:pb-4">
            <div className="mb-4 flex items-baseline gap-2">
              <h1 className="text-foreground text-lg font-semibold -tracking-[0.01em]">Catalog</h1>
              {catalogTotal != null && (
                <span className="text-[12px] text-[var(--text-tertiary)] tabular-nums">
                  {catalogTotal} {catalogTotal === 1 ? "game" : "games"}
                </span>
              )}
            </div>
            <CatalogBrowser
              libraryGameIds={libraryGameIds}
              onAdd={handleAdd}
              searchFilter={search}
              drawerExpanded={drawerExpanded}
              steamFilterOn={steamFilterOn}
              steamMatchedGameIds={steamLib.matchedGameIds}
              requestFormEnabled={requestFormEnabled}
              turnstileSiteKey={turnstileSiteKey}
              onCatalogLoaded={handleCatalogLoaded}
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

      {/*
       * Mobile library affordance — the desktop drawer is hidden below lg,
       * which left mobile users with no way to see library state or start
       * curation from /catalog (BUG-2). This fixed bottom bar surfaces the
       * count and a Curate CTA once there's at least one game in the library.
       */}
      {libraryCount > 0 && (
        <div className="bg-background/95 border-border pointer-events-auto fixed inset-x-0 bottom-0 z-20 flex items-center justify-between gap-3 border-t px-4 py-3 backdrop-blur-sm lg:hidden">
          <span className="text-foreground text-sm font-medium">
            Library · <span className="tabular-nums">{libraryCount}</span>
          </span>
          <button
            type="button"
            onClick={handleCurate}
            className="bg-primary text-foreground min-h-11 cursor-pointer rounded-lg px-5 py-2 text-sm font-medium transition-colors hover:bg-[var(--primary-hover)]"
          >
            Curate →
          </button>
        </div>
      )}

      {playlist.tracks.length > 0 && (
        <div className="hidden lg:flex">
          <PlayerPanel />
        </div>
      )}
    </div>
  );
}
