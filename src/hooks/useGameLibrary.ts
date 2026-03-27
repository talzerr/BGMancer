"use client";

import { useCallback, useEffect, useState } from "react";
import type { Game } from "@/types";
import type { GameStatusPayload } from "@/lib/events";

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

  // SSE subscription for game phase updates. Vestigial for user-facing code (games don't
  // change phase in user flow), but kept for potential Backstage real-time dashboard use.
  useEffect(() => {
    const source = new EventSource("/api/games/status-stream");

    source.onmessage = (e: MessageEvent) => {
      const event = JSON.parse(e.data) as GameStatusPayload;
      setGames((prev) =>
        prev.map((g) => (g.id === event.gameId ? { ...g, onboarding_phase: event.phase } : g)),
      );
    };

    source.onerror = (err) => {
      console.error("[useGameLibrary] SSE error:", err);
    };

    return () => source.close();
  }, []);

  return { games, gamesLoading, fetchGames, handleGameAdded, deleteGame };
}
