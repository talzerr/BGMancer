"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Game, PlaylistTrack } from "@/types";
import { AddGameForm } from "@/components/AddGameForm";
import { GameCard } from "@/components/GameCard";
import { PlaylistTrackCard } from "@/components/PlaylistTrackCard";
import { PlayerBar, type PlayerBarHandle } from "@/components/PlayerBar";
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
  const [confirmClear, setConfirmClear] = useState(false);
  const [isPlayerPlaying, setIsPlayerPlaying] = useState(false);
  const playerBarRef = useRef<PlayerBarHandle | null>(null);

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
      setCurrentTrackIndex(null);
    } catch (err) {
      console.error("Failed to clear playlist:", err);
    } finally {
      setConfirmClear(false);
    }
  }

  const pendingCount = tracks.filter((t) => t.status === "pending").length;
  const foundCount = tracks.filter((t) => t.status === "found").length;
  const errorCount = tracks.filter((t) => t.status === "error").length;
  const hasFoundTracks = foundCount > 0;

  // Only found tracks are playable; map their position in the full list
  const foundTracks = tracks.filter((t) => t.status === "found");

  // Which game is currently playing (for sidebar visual mapping)
  const activeGameId = currentTrackIndex !== null ? foundTracks[currentTrackIndex]?.game_id ?? null : null;

  // Vibe lookup map for color-coding playlist track rows
  const gameVibeMap = Object.fromEntries(games.map(g => [g.id, g.vibe_preference]));


  return (
    <>
    <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-5 items-start">

      {/* ── Left panel: Game Library ─────────────────────────────────────── */}
      <aside className="flex flex-col gap-4">
        <section className="rounded-2xl bg-zinc-900/70 border border-white/[0.07] p-5 backdrop-blur-sm shadow-lg shadow-black/40">
          <h2 className="text-[11px] font-bold text-zinc-500 uppercase tracking-widest mb-4">Add a Game</h2>
          <AddGameForm onGameAdded={handleGameAdded} />
        </section>

        {/* ── Generate button — between Add a Game and the library ── */}
        <div className="flex flex-col gap-2">
          <button
            onClick={handleGenerate}
            disabled={generating || games.length === 0}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-teal-600 hover:bg-teal-500 disabled:bg-zinc-800/80 disabled:text-zinc-500 disabled:border disabled:border-white/[0.05] px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-teal-900/40 cursor-pointer disabled:cursor-not-allowed"
          >
            {generating ? (
              <>
                <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 100 16v-4l-3 3 3 3v-4a8 8 0 01-8-8z" />
                </svg>
                Generating…
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
                </svg>
                Generate Playlist
              </>
            )}
          </button>
          {genError && (
            <div className="flex items-start gap-2 rounded-xl bg-red-950/40 border border-red-500/20 px-3 py-2.5 text-xs text-red-400">
              <svg className="w-3.5 h-3.5 shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              {genError}
            </div>
          )}
        </div>

        <section className="rounded-2xl bg-zinc-900/70 border border-white/[0.07] p-5 backdrop-blur-sm shadow-lg shadow-black/40">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[11px] font-bold text-zinc-500 uppercase tracking-widest">
              Game Library
            </h2>
            {games.length > 0 && (
              <span className="text-[11px] font-medium text-zinc-400 tabular-nums">
                {games.length} game{games.length !== 1 ? "s" : ""}
              </span>
            )}
          </div>

          {gamesLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-[52px] rounded-xl bg-zinc-800/40 animate-pulse" />
              ))}
            </div>
          ) : games.length === 0 ? (
            <p className="text-sm text-zinc-500 py-6 text-center">
              No games yet.
            </p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {games.map((game) => (
                <GameCard
                  key={game.id}
                  game={game}
                  isActive={game.id === activeGameId}
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
        <div className="flex flex-wrap items-center gap-2">
          {pendingCount > 0 && (
            <button
              onClick={handleFindVideos}
              disabled={searching}
              title="Search YouTube for full-OST compilation videos"
              className="flex items-center gap-2 rounded-xl bg-zinc-800/80 hover:bg-zinc-700/80 border border-white/[0.06] disabled:opacity-50 px-4 py-2.5 text-sm font-semibold text-zinc-300 cursor-pointer disabled:cursor-not-allowed"
            >
              {searching ? (
                <>
                  <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 100 16v-4l-3 3 3 3v-4a8 8 0 01-8-8z" />
                  </svg>
                  Searching…
                </>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5 text-amber-400" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
                  </svg>
                  Find Missing ({pendingCount})
                </>
              )}
            </button>
          )}

          {authConfigured && (
            <SyncButton
              isSignedIn={isSignedIn}
              authConfigured={authConfigured}
              hasFoundGames={hasFoundTracks}
              onSyncComplete={() => {}}
            />
          )}

          {tracks.length > 0 && (
            <div className="ml-auto flex items-center gap-2">
              {confirmClear ? (
                <>
                  <span className="text-xs text-zinc-500">Clear all tracks?</span>
                  <button
                    onClick={handleClearPlaylist}
                    className="rounded-lg bg-red-600/90 hover:bg-red-500 px-2.5 py-1 text-xs font-medium text-white cursor-pointer"
                  >
                    Yes, clear
                  </button>
                  <button
                    onClick={() => setConfirmClear(false)}
                    className="rounded-lg bg-zinc-800 hover:bg-zinc-700 px-2.5 py-1 text-xs font-medium text-zinc-400 cursor-pointer"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setConfirmClear(true)}
                  className="text-xs text-zinc-500 hover:text-red-400 cursor-pointer"
                >
                  Clear playlist
                </button>
              )}
            </div>
          )}
        </div>


        {/* Stats row */}
        {tracks.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-white tabular-nums">{tracks.length}</span>
            <span className="text-xs text-zinc-500">tracks</span>
            {foundCount > 0 && (
              <>
                <span className="text-zinc-700 text-xs">·</span>
                <span className="flex items-center gap-1.5 text-xs">
                  <svg className="w-3 h-3 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span className="font-semibold text-emerald-400 tabular-nums">{foundCount}</span>
                  <span className="text-zinc-500">ready to play</span>
                </span>
              </>
            )}
            {pendingCount > 0 && (
              <>
                <span className="text-zinc-700 text-xs">·</span>
                <span className="flex items-center gap-1 text-xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                  <span className="font-semibold text-amber-400 tabular-nums">{pendingCount}</span>
                  <span className="text-zinc-500">pending</span>
                </span>
              </>
            )}
            {errorCount > 0 && (
              <>
                <span className="text-zinc-700 text-xs">·</span>
                <span className="flex items-center gap-1 text-xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
                  <span className="font-semibold text-red-400 tabular-nums">{errorCount}</span>
                  <span className="text-zinc-500">error{errorCount !== 1 ? "s" : ""}</span>
                </span>
              </>
            )}
          </div>
        )}

        {/* Track list */}
        {tracksLoading ? (
          <div className="space-y-1.5">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-[52px] rounded-xl bg-zinc-900/50 animate-pulse" style={{ opacity: 1 - i * 0.12 }} />
            ))}
          </div>
        ) : tracks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center rounded-2xl bg-zinc-900/30 border border-white/[0.04]">
            <div className="w-14 h-14 rounded-2xl bg-zinc-800/60 border border-white/[0.06] flex items-center justify-center mb-4">
              <svg className="w-7 h-7 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
              </svg>
            </div>
            <h3 className="text-sm font-semibold text-zinc-400 mb-1.5">No playlist yet</h3>
            <p className="text-sm text-zinc-400 max-w-xs leading-relaxed">
              {games.length === 0
                ? "Add some games to your library, then generate a playlist."
                : "Click Generate Playlist to create your AI-curated soundtrack."}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-1.5 pb-24">
            {tracks.map((track, i) => {
              const foundIdx = foundTracks.findIndex((ft) => ft.id === track.id);
              const isCurrentTrack = currentTrackIndex === foundIdx && foundIdx !== -1;
              return (
                <PlaylistTrackCard
                  key={track.id}
                  track={track}
                  index={i}
                  vibe={gameVibeMap[track.game_id]}
                  isPlaying={isCurrentTrack}
                  isActivelyPlaying={isCurrentTrack && isPlayerPlaying}
                  onPlay={foundIdx !== -1 ? () => {
                    if (isCurrentTrack) {
                      playerBarRef.current?.togglePlayPause();
                    } else {
                      setCurrentTrackIndex(foundIdx);
                    }
                  } : undefined}
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
        ref={playerBarRef}
        tracks={foundTracks}
        currentIndex={currentTrackIndex}
        onIndexChange={(i) => setCurrentTrackIndex(i)}
        onClose={() => setCurrentTrackIndex(null)}
        onPlayingChange={setIsPlayerPlaying}
      />
    )}
    </>
  );
}
