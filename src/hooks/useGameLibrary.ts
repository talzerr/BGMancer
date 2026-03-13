"use client";

import { useCallback, useEffect, useState } from "react";
import { TaggingStatus } from "@/types";
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

  const hasIndexing = games.some(
    (g) =>
      g.tagging_status === TaggingStatus.Indexing || g.tagging_status === TaggingStatus.Pending,
  );

  useEffect(() => {
    if (!hasIndexing) return;
    const id = setInterval(() => {
      fetchGames();
    }, 3000);
    return () => clearInterval(id);
  }, [hasIndexing, fetchGames]);

  return { games, gamesLoading, fetchGames, handleGameAdded, deleteGame };
}
