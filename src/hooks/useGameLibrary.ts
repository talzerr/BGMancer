"use client";

import { useCallback, useState } from "react";
import type { Game } from "@/types";

export function useGameLibrary() {
  const [games, setGames] = useState<Game[]>([]);
  const [gamesLoading, setGamesLoading] = useState(true);

  const fetchGames = useCallback(async () => {
    try {
      const res = await fetch("/api/games");
      if (res.ok) setGames(await res.json());
    } catch (err) {
      console.error("Failed to fetch games:", err);
    } finally {
      setGamesLoading(false);
    }
  }, []);

  function handleGameAdded(game: Game) {
    setGames((prev) => [...prev, game]);
  }

  async function handleToggleFullOST(gameId: string, value: boolean) {
    setGames((prev) =>
      prev.map((g) => (g.id === gameId ? { ...g, allow_full_ost: value } : g))
    );
    try {
      await fetch(`/api/games?id=${gameId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ allow_full_ost: value }),
      });
    } catch {
      // Revert on error
      setGames((prev) =>
        prev.map((g) => (g.id === gameId ? { ...g, allow_full_ost: !value } : g))
      );
    }
  }

  /** Returns true if the game was successfully deleted. */
  async function deleteGame(gameId: string): Promise<boolean> {
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
  }

  return { games, gamesLoading, fetchGames, handleGameAdded, handleToggleFullOST, deleteGame };
}
