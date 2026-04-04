"use client";

import { useCallback, useRef, useState } from "react";
import type { CurationMode, Game } from "@/types";
import { LIBRARY_MAX_GAMES } from "@/lib/constants";
import { readGuestLibrary, writeGuestLibrary } from "@/lib/guest-library";

export function useGameLibrary(isSignedIn: boolean) {
  const [games, setGames] = useState<Game[]>([]);
  const [gamesLoading, setGamesLoading] = useState(true);
  // Cache catalog for guest hydration so we don't re-fetch every time.
  const catalogCache = useRef<Game[] | null>(null);

  async function fetchCatalog(): Promise<Game[]> {
    if (catalogCache.current) return catalogCache.current;
    try {
      const res = await fetch("/api/games/catalog");
      if (res.ok) {
        const data: Game[] = await res.json();
        catalogCache.current = data;
        return data;
      }
    } catch {
      /* non-critical */
    }
    return [];
  }

  const fetchGames = useCallback(async () => {
    try {
      if (isSignedIn) {
        const res = await fetch("/api/games");
        if (res.ok) setGames(await res.json());
      } else {
        const entries = readGuestLibrary();
        if (entries.length === 0) {
          setGames([]);
          return;
        }
        const catalog = await fetchCatalog();
        const catalogMap = new Map(catalog.map((g) => [g.id, g]));
        const hydrated: Game[] = [];
        for (const entry of entries) {
          const game = catalogMap.get(entry.gameId);
          if (game) hydrated.push({ ...game, curation: entry.curation });
        }
        setGames(hydrated);
      }
    } catch (err) {
      console.error("Failed to fetch games:", err);
    } finally {
      setGamesLoading(false);
    }
  }, [isSignedIn]);

  async function addGame(game: Game, curation: CurationMode): Promise<void> {
    if (isSignedIn) {
      const res = await fetch("/api/games", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameId: game.id, curation }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setGames((prev) => [...prev, { ...game, curation }]);
    } else {
      const entries = readGuestLibrary();
      if (entries.length >= LIBRARY_MAX_GAMES) {
        throw new Error(`Library limit reached (${LIBRARY_MAX_GAMES} games max)`);
      }
      if (entries.some((e) => e.gameId === game.id)) return;
      writeGuestLibrary([...entries, { gameId: game.id, curation }]);
      setGames((prev) => [...prev, { ...game, curation }]);
    }
  }

  async function updateCuration(gameId: string, curation: CurationMode): Promise<void> {
    if (isSignedIn) {
      const res = await fetch(`/api/games?id=${gameId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ curation }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } else {
      const entries = readGuestLibrary();
      writeGuestLibrary(entries.map((e) => (e.gameId === gameId ? { ...e, curation } : e)));
    }
    setGames((prev) => prev.map((g) => (g.id === gameId ? { ...g, curation } : g)));
  }

  async function deleteGame(gameId: string): Promise<boolean> {
    if (isSignedIn) {
      try {
        const res = await fetch(`/api/games?id=${gameId}`, { method: "DELETE" });
        if (res.ok) {
          setGames((prev) => prev.filter((g) => g.id !== gameId));
          return true;
        }
      } catch (err) {
        console.error("Failed to delete game:", err);
      }
      return false;
    } else {
      const entries = readGuestLibrary();
      writeGuestLibrary(entries.filter((e) => e.gameId !== gameId));
      setGames((prev) => prev.filter((g) => g.id !== gameId));
      return true;
    }
  }

  return {
    games,
    gamesLoading,
    fetchGames,
    addGame,
    updateCuration,
    deleteGame,
  };
}
