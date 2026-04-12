"use client";

import { useCallback, useRef, useState } from "react";
import type { CurationMode, Game } from "@/types";
import { LIBRARY_MAX_GAMES } from "@/lib/constants";
import {
  readGuestLibrary,
  writeGuestLibrary,
  writeGuestLibraryHydrated,
} from "@/lib/guest-library";

export function useGameLibrary(isSignedIn: boolean, initialGames: Game[] = []) {
  const [games, setGames] = useState<Game[]>(initialGames);
  const [isLoading, setIsLoading] = useState(games.length === 0);
  const [error, setError] = useState<string | null>(null);
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
      setError(null);
      if (isSignedIn) {
        const res = await fetch("/api/games");
        if (res.ok) setGames(await res.json());
      } else {
        const entries = readGuestLibrary();
        if (entries.length === 0) {
          setGames([]);
          writeGuestLibraryHydrated([]);
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
        writeGuestLibraryHydrated(hydrated);
      }
    } catch (err) {
      console.error("Failed to fetch games:", err);
      setError("Failed to load game library");
    } finally {
      setIsLoading(false);
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
      setGames((prev) => {
        const next = [...prev, { ...game, curation }];
        writeGuestLibraryHydrated(next);
        return next;
      });
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
    setGames((prev) => {
      const next = prev.map((g) => (g.id === gameId ? { ...g, curation } : g));
      if (!isSignedIn) writeGuestLibraryHydrated(next);
      return next;
    });
  }

  async function deleteGame(gameId: string): Promise<boolean> {
    setError(null);
    if (isSignedIn) {
      try {
        const res = await fetch(`/api/games?id=${gameId}`, { method: "DELETE" });
        if (res.ok) {
          setGames((prev) => prev.filter((g) => g.id !== gameId));
          return true;
        }
      } catch (err) {
        console.error("Failed to delete game:", err);
        setError("Failed to delete game");
      }
      return false;
    } else {
      const entries = readGuestLibrary();
      writeGuestLibrary(entries.filter((e) => e.gameId !== gameId));
      setGames((prev) => {
        const next = prev.filter((g) => g.id !== gameId);
        writeGuestLibraryHydrated(next);
        return next;
      });
      return true;
    }
  }

  return {
    games,
    isLoading,
    error,
    fetchGames,
    addGame,
    updateCuration,
    deleteGame,
  };
}
