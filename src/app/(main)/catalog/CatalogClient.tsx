"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { signIn, signOut } from "next-auth/react";
import { clearPlaybackState } from "@/hooks/player/playback-state";
import { clearGuestLibrary } from "@/lib/guest-library";
import { usePlayerContext } from "@/context/player-context";
import { useSteamLibrary } from "@/hooks/library/useSteamLibrary";
import { CatalogBrowser } from "@/components/library/CatalogBrowser";
import { CatalogHeaderBar } from "@/components/library/CatalogHeaderBar";
import { CatalogSteamControls } from "@/components/library/CatalogSteamControls";
import { LibraryDrawer } from "@/components/library/LibraryDrawer";
import { PlayerPanel } from "@/components/player/PlayerPanel";
import type { CurationMode, Game } from "@/types";

interface CatalogClientProps {
  requestFormEnabled: boolean;
  turnstileSiteKey: string | undefined;
  userName: string | null;
}

function LogoLink() {
  return (
    <Link href="/" className="flex items-center gap-2.5">
      <Image
        src="/icon-192.png"
        alt="BGMancer"
        width={20}
        height={20}
        className="h-5 w-5 shrink-0"
        priority
      />
      <h1 className="font-display text-foreground text-[14px] leading-[1.2] font-semibold -tracking-[0.03em]">
        BGMancer
      </h1>
    </Link>
  );
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
      {/* Center: header + controls + scrollable grid */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex shrink-0 items-center justify-between px-4 pt-[18px] pb-3 sm:px-6">
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

      {/* Library drawer — fixed panel */}
      <LibraryDrawer
        games={gameLibrary.games}
        isExpanded={drawerExpanded}
        onExpandedChange={setDrawerOverride}
        onCurationChange={handleCurationChange}
        onRemove={handleRemove}
        onCurate={handleCurate}
        userName={userName}
        onSignIn={!userName ? () => signIn("google", { callbackUrl: "/catalog" }) : undefined}
        onSignOut={
          userName
            ? () => {
                clearPlaybackState();
                clearGuestLibrary();
                signOut({ callbackUrl: "/" });
              }
            : undefined
        }
      />

      {/* Player strip */}
      {playlist.tracks.length > 0 && (
        <div className="hidden lg:flex">
          <PlayerPanel />
        </div>
      )}
    </div>
  );
}
