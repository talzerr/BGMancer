"use client";

import { useCallback, useEffect, useState } from "react";
import type { Game } from "@/types";
import { AddGameForm } from "@/components/AddGameForm";
import { GameCard } from "@/components/GameCard";
import { SyncButton } from "@/components/SyncButton";

interface FeedClientProps {
  isSignedIn: boolean;
  authConfigured: boolean;
}

export function FeedClient({ isSignedIn, authConfigured }: FeedClientProps) {
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [curatingIds, setCuratingIds] = useState<Set<string>>(new Set());

  const fetchGames = useCallback(async () => {
    try {
      const res = await fetch("/api/games");
      if (res.ok) {
        const data: Game[] = await res.json();
        setGames(data);
      }
    } catch (err) {
      console.error("Failed to fetch games:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGames();
  }, [fetchGames]);

  function handleGameAdded(game: Game) {
    setGames((prev) => [game, ...prev]);
  }

  async function handleCurate(gameId: string) {
    setCuratingIds((prev) => new Set(prev).add(gameId));

    // Optimistically mark as searching
    setGames((prev) =>
      prev.map((g) => (g.id === gameId ? { ...g, status: "searching" } : g))
    );

    try {
      const res = await fetch("/api/curator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ game_id: gameId }),
      });

      const data = await res.json();

      if (res.ok) {
        setGames((prev) =>
          prev.map((g) =>
            g.id === gameId
              ? {
                  ...g,
                  status: "found",
                  current_video_id: data.video_id,
                  video_title: data.video_title,
                  channel_title: data.channel_title,
                  video_thumbnail: data.video_thumbnail,
                  search_queries: data.search_queries,
                  error_message: null,
                }
              : g
          )
        );
      } else {
        setGames((prev) =>
          prev.map((g) =>
            g.id === gameId
              ? {
                  ...g,
                  status: "error",
                  search_queries: data.search_queries ?? g.search_queries,
                  error_message: data.error ?? "Curator failed",
                }
              : g
          )
        );
      }
    } catch (err) {
      setGames((prev) =>
        prev.map((g) =>
          g.id === gameId
            ? { ...g, status: "error", error_message: "Network error" }
            : g
        )
      );
    } finally {
      setCuratingIds((prev) => {
        const next = new Set(prev);
        next.delete(gameId);
        return next;
      });
    }
  }

  async function handleDelete(gameId: string) {
    try {
      const res = await fetch(`/api/games?id=${gameId}`, { method: "DELETE" });
      if (res.ok) {
        setGames((prev) => prev.filter((g) => g.id !== gameId));
      }
    } catch (err) {
      console.error("Failed to delete game:", err);
    }
  }

  function handleSyncComplete() {
    // Refresh games list to reflect updated statuses
    fetchGames();
  }

  const hasFoundGames = games.some((g) => g.status === "found");
  const pendingCount = games.filter((g) => g.status === "pending").length;
  const foundCount = games.filter((g) => g.status === "found" || g.status === "synced").length;

  return (
    <div className="flex flex-col gap-8">
      {/* Add game section */}
      <section className="rounded-xl bg-zinc-900 border border-zinc-800 p-5">
        <h2 className="text-sm font-semibold text-zinc-300 mb-4">Add a Game</h2>
        <AddGameForm onGameAdded={handleGameAdded} />
      </section>

      {/* Stats + Sync row */}
      {games.length > 0 && (
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4 text-sm text-zinc-400">
            <span>
              <span className="font-semibold text-white">{games.length}</span> game{games.length !== 1 ? "s" : ""}
            </span>
            {foundCount > 0 && (
              <span>
                <span className="font-semibold text-emerald-400">{foundCount}</span> with OST
              </span>
            )}
            {pendingCount > 0 && (
              <span>
                <span className="font-semibold text-amber-400">{pendingCount}</span> pending
              </span>
            )}
          </div>

          <SyncButton
            isSignedIn={isSignedIn}
            authConfigured={authConfigured}
            hasFoundGames={hasFoundGames}
            onSyncComplete={handleSyncComplete}
          />
        </div>
      )}

      {/* Games grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-xl bg-zinc-800/40 border border-zinc-700/30 aspect-[4/3] animate-pulse" />
          ))}
        </div>
      ) : games.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-16 h-16 rounded-2xl bg-zinc-800 flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
            </svg>
          </div>
          <h3 className="text-base font-semibold text-zinc-300 mb-1">No games yet</h3>
          <p className="text-sm text-zinc-500 max-w-xs">
            Add a game above to start building your AI-curated OST collection.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {games.map((game) => (
            <GameCard
              key={game.id}
              game={game}
              onCurate={handleCurate}
              onDelete={handleDelete}
              isCurating={curatingIds.has(game.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
