"use client";

import { useCallback, useEffect, useState } from "react";
import type { Game, PlaylistTrack } from "@/types";
import { AddGameForm } from "@/components/AddGameForm";
import { GameCard } from "@/components/GameCard";
import { PlaylistTrackCard } from "@/components/PlaylistTrackCard";
import { PlayerBar } from "@/components/PlayerBar";
import { SyncButton } from "@/components/SyncButton";

interface FeedClientProps {
  isSignedIn: boolean;
  authConfigured: boolean;
}

export function FeedClient({ isSignedIn, authConfigured }: FeedClientProps) {
  const [games, setGames] = useState<Game[]>([]);
  const [tracks, setTracks] = useState<PlaylistTrack[]>([]);
  const [gamesLoading, setGamesLoading] = useState(true);
  const [tracksLoading, setTracksLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [searching, setSearching] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [currentTrackIndex, setCurrentTrackIndex] = useState<number | null>(null);

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

  const fetchTracks = useCallback(async () => {
    try {
      const res = await fetch("/api/playlist");
      if (res.ok) setTracks(await res.json());
    } catch (err) {
      console.error("Failed to fetch playlist:", err);
    } finally {
      setTracksLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGames();
    fetchTracks();
  }, [fetchGames, fetchTracks]);

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
    } catch (err) {
      console.error("Failed to update game:", err);
      // Revert on error
      setGames((prev) =>
        prev.map((g) => (g.id === gameId ? { ...g, allow_full_ost: !value } : g))
      );
    }
  }

  async function handleDeleteGame(gameId: string) {
    try {
      const res = await fetch(`/api/games?id=${gameId}`, { method: "DELETE" });
      if (res.ok) {
        setGames((prev) => prev.filter((g) => g.id !== gameId));
        // Remove associated tracks from local state too
        setTracks((prev) => prev.filter((t) => t.game_id !== gameId));
      }
    } catch (err) {
      console.error("Failed to delete game:", err);
    }
  }

  async function handleGenerate() {
    if (games.length === 0) return;
    setGenerating(true);
    setGenError(null);
    setCurrentTrackIndex(null); // close player while regenerating

    try {
      const res = await fetch("/api/playlist/generate", { method: "POST" });
      const data = await res.json();

      if (!res.ok) {
        setGenError(data.error ?? "Generation failed");
        return;
      }

      setTracks(data.tracks ?? []);
    } catch (err) {
      setGenError(err instanceof Error ? err.message : "Network error");
    } finally {
      setGenerating(false);
    }
  }

  async function handleFindVideos() {
    setSearching(true);

    try {
      const res = await fetch("/api/playlist/search", { method: "POST" });
      const data = await res.json();

      if (res.ok && data.tracks) {
        setTracks(data.tracks);
      }
    } catch (err) {
      console.error("Failed to search videos:", err);
    } finally {
      setSearching(false);
    }
  }

  async function handleClearPlaylist() {
    try {
      await fetch("/api/playlist", { method: "DELETE" });
      setTracks([]);
    } catch (err) {
      console.error("Failed to clear playlist:", err);
    }
  }

  const pendingCount = tracks.filter((t) => t.status === "pending").length;
  const foundCount = tracks.filter((t) => t.status === "found").length;
  const errorCount = tracks.filter((t) => t.status === "error").length;
  const hasFoundTracks = foundCount > 0;

  // Only found tracks are playable; map their position in the full list
  const foundTracks = tracks.filter((t) => t.status === "found");


  return (
    <>
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_2fr] gap-6 items-start">

      {/* ── Left panel: Game Library ─────────────────────────────────────── */}
      <aside className="flex flex-col gap-4">
        <section className="rounded-xl bg-zinc-900 border border-zinc-800 p-5">
          <h2 className="text-sm font-semibold text-zinc-300 mb-4">Add a Game</h2>
          <AddGameForm onGameAdded={handleGameAdded} />
        </section>

        <section className="rounded-xl bg-zinc-900 border border-zinc-800 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-zinc-300">
              Game Library
              {games.length > 0 && (
                <span className="ml-2 text-xs font-normal text-zinc-500">
                  {games.length} game{games.length !== 1 ? "s" : ""}
                </span>
              )}
            </h2>
          </div>

          {gamesLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-14 rounded-xl bg-zinc-800/40 animate-pulse" />
              ))}
            </div>
          ) : games.length === 0 ? (
            <p className="text-sm text-zinc-500 py-4 text-center">
              No games yet — add one above.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {games.map((game) => (
                <GameCard
                  key={game.id}
                  game={game}
                  onToggleFullOST={handleToggleFullOST}
                  onDelete={handleDeleteGame}
                />
              ))}
            </div>
          )}
        </section>
      </aside>

      {/* ── Right panel: Playlist ─────────────────────────────────────────── */}
      <main className="flex flex-col gap-4">
        {/* Action bar */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handleGenerate}
            disabled={generating || games.length === 0}
            className="rounded-lg bg-violet-600 hover:bg-violet-500 disabled:bg-zinc-700 disabled:text-zinc-400 px-5 py-2.5 text-sm font-semibold text-white transition cursor-pointer disabled:cursor-not-allowed"
          >
            {generating ? (
              <span className="flex items-center gap-2">
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 100 16v-4l-3 3 3 3v-4a8 8 0 01-8-8z" />
                </svg>
                Generating…
              </span>
            ) : (
              "Generate Playlist"
            )}
          </button>

          {pendingCount > 0 && (
            <button
              onClick={handleFindVideos}
              disabled={searching}
              title="Search YouTube for full-OST compilation videos"
              className="rounded-lg bg-emerald-700 hover:bg-emerald-600 disabled:bg-zinc-700 disabled:text-zinc-400 px-5 py-2.5 text-sm font-semibold text-white transition cursor-pointer disabled:cursor-not-allowed"
            >
              {searching ? (
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 100 16v-4l-3 3 3 3v-4a8 8 0 01-8-8z" />
                  </svg>
                  Searching…
                </span>
              ) : (
                `Find Missing Videos (${pendingCount})`
              )}
            </button>
          )}

          <SyncButton
            isSignedIn={isSignedIn}
            authConfigured={authConfigured}
            hasFoundGames={hasFoundTracks}
            onSyncComplete={() => {}}
          />

          {tracks.length > 0 && (
            <button
              onClick={handleClearPlaylist}
              className="ml-auto text-xs text-zinc-500 hover:text-red-400 transition cursor-pointer"
            >
              Clear playlist
            </button>
          )}
        </div>

        {genError && (
          <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
            {genError}
          </div>
        )}

        {/* Stats row */}
        {tracks.length > 0 && (
          <div className="flex items-center gap-4 text-xs text-zinc-400">
            <span><span className="font-semibold text-white">{tracks.length}</span> tracks</span>
            {foundCount > 0 && <span><span className="font-semibold text-emerald-400">{foundCount}</span> found</span>}
            {pendingCount > 0 && <span><span className="font-semibold text-amber-400">{pendingCount}</span> pending</span>}
            {errorCount > 0 && <span><span className="font-semibold text-red-400">{errorCount}</span> error{errorCount !== 1 ? "s" : ""}</span>}
          </div>
        )}

        {/* Track list */}
        {tracksLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-16 rounded-xl bg-zinc-800/40 animate-pulse" />
            ))}
          </div>
        ) : tracks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center rounded-xl bg-zinc-900/50 border border-zinc-800">
            <div className="w-16 h-16 rounded-2xl bg-zinc-800 flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
              </svg>
            </div>
            <h3 className="text-base font-semibold text-zinc-300 mb-1">No playlist yet</h3>
            <p className="text-sm text-zinc-500 max-w-xs">
              {games.length === 0
                ? "Add some games in the library, then click Generate Playlist."
                : "Click Generate Playlist to create your AI-curated track list."}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2 pb-24">
            {tracks.map((track, i) => {
              const foundIdx = foundTracks.findIndex((ft) => ft.id === track.id);
              return (
                <PlaylistTrackCard
                  key={track.id}
                  track={track}
                  index={i}
                  isPlaying={currentTrackIndex !== null && foundTracks[currentTrackIndex]?.id === track.id}
                  onPlay={foundIdx !== -1 ? () => setCurrentTrackIndex(foundIdx) : undefined}
                />
              );
            })}
          </div>
        )}
      </main>
    </div>

    {/* ── Sticky player bar ─────────────────────────────────────────────── */}
    {currentTrackIndex !== null && foundTracks.length > 0 && (
      <PlayerBar
        tracks={foundTracks}
        currentIndex={currentTrackIndex}
        onIndexChange={(i) => setCurrentTrackIndex(i)}
        onClose={() => setCurrentTrackIndex(null)}
      />
    )}
    </>
  );
}
