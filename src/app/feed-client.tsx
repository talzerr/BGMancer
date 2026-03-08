"use client";

import { useEffect } from "react";
import type { SyntheticEvent } from "react";
import type { VibePreference } from "@/types";
import Link from "next/link";
import { useGameLibrary } from "@/hooks/useGameLibrary";
import { useConfig } from "@/hooks/useConfig";
import { usePlayerContext } from "@/context/player-context";
import { GenerateSection } from "@/components/GenerateSection";
import { PlaylistTrackCard } from "@/components/PlaylistTrackCard";
import { PlaylistEmptyState } from "@/components/PlaylistEmptyState";
import { SyncButton } from "@/components/SyncButton";
import { Spinner, SearchIcon, CheckIcon } from "@/components/Icons";

interface FeedClientProps {
  isSignedIn: boolean;
  authConfigured: boolean;
}

export function FeedClient({ isSignedIn, authConfigured }: FeedClientProps) {
  const gameLibrary = useGameLibrary();
  const config = useConfig();
  const { playlist, player } = usePlayerContext();

  // Initial data fetch — playlist is already fetched by PlayerProvider on mount;
  // we only need to refresh games here.
  useEffect(() => {
    gameLibrary.fetchGames();
  }, [gameLibrary.fetchGames]);

  // ── Cross-hook action coordinators ──────────────────────────────────────────

  async function handleGenerate() {
    player.reset();
    await playlist.handleGenerate(gameLibrary.games);
  }

  async function handleClearPlaylist() {
    await playlist.handleClearPlaylist();
    player.reset();
  }

  async function handleImport(e: SyntheticEvent<HTMLFormElement>) {
    const success = await playlist.handleImport(e);
    if (success) player.reset();
  }

  // ── Derived values ───────────────────────────────────────────────────────────

  const pendingCount = playlist.tracks.filter((t) => t.status === "pending").length;
  const foundCount = playlist.tracks.filter((t) => t.status === "found").length;
  const errorCount = playlist.tracks.filter((t) => t.status === "error").length;
  const hasFoundTracks = foundCount > 0;
  const gameVibeMap = Object.fromEntries(
    gameLibrary.games.map((g) => [g.id, g.vibe_preference])
  ) as Record<string, VibePreference>;

  const playingGameTitle = playlist.tracks.find(
    (t) => t.id === player.playingTrackId
  )?.game_title ?? null;

  const totalDurationSeconds = playlist.tracks
    .filter((t) => t.status === "found")
    .reduce((sum, t) => sum + (t.duration_seconds ?? 0), 0);

  function formatDuration(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h === 0) return `${m}m`;
    return m === 0 ? `${h}h` : `${h}h ${m}m`;
  }

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-5 items-start">

        {/* ── Left panel ──────────────────────────────────────────────────── */}
        <aside className="flex flex-col gap-4">
          <GenerateSection
            generating={playlist.generating}
            genProgress={playlist.genProgress}
            genGlobalMsg={playlist.genGlobalMsg}
            genError={playlist.genError}
            targetTrackCount={config.targetTrackCount}
            onTargetChange={config.setTargetTrackCount}
            onTargetSave={config.saveTrackCount}
            gamesCount={gameLibrary.games.length}
            onGenerate={handleGenerate}
          />

          <section className="rounded-2xl bg-zinc-900/70 border border-white/[0.07] p-4 backdrop-blur-sm shadow-lg shadow-black/40">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm font-semibold text-white tabular-nums">
                  {gameLibrary.games.length}
                </span>
                <span className="text-sm text-zinc-500 ml-1.5">
                  active game{gameLibrary.games.length !== 1 ? "s" : ""}
                </span>
              </div>
              <Link
                href="/library"
                className="text-xs font-medium text-teal-400 hover:text-teal-300 transition-colors"
              >
                Manage Library →
              </Link>
            </div>
            {playingGameTitle && (
              <div className="mt-2.5 flex items-center gap-2">
                <span className="relative flex h-2 w-2 shrink-0">
                  {player.isPlayerPlaying && (
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75" />
                  )}
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-violet-500" />
                </span>
                <span className="text-xs truncate">
                  <span className="text-zinc-600">From </span>
                  <span className="text-zinc-300 font-medium">{playingGameTitle}</span>
                </span>
              </div>
            )}
            {!gameLibrary.gamesLoading && gameLibrary.games.length === 0 && (
              <p className="mt-2 text-xs text-zinc-600">
                No active games.{" "}
                <Link href="/library" className="text-teal-500 hover:text-teal-400">
                  Go to Library
                </Link>{" "}
                to add or activate games.
              </p>
            )}
          </section>
        </aside>

        {/* ── Right panel: Playlist ────────────────────────────────────────── */}
        <main className="flex flex-col gap-4">
          {/* Action bar */}
          <div className="flex flex-wrap items-center gap-2">
            {pendingCount > 0 && (
              <button
                onClick={playlist.handleFindVideos}
                disabled={playlist.searching}
                className="flex items-center gap-2 rounded-xl bg-zinc-800/80 hover:bg-zinc-700/80 border border-white/[0.06] disabled:opacity-50 px-4 py-2.5 text-sm font-semibold text-zinc-300 cursor-pointer disabled:cursor-not-allowed"
              >
                {playlist.searching ? (
                  <>
                    <Spinner className="w-3.5 h-3.5" />
                    Searching…
                  </>
                ) : (
                  <>
                    <SearchIcon className="w-3.5 h-3.5 text-amber-400" />
                    Find Missing ({pendingCount})
                  </>
                )}
              </button>
            )}

            {authConfigured && (
              <SyncButton
                isSignedIn={isSignedIn}
                authConfigured={authConfigured}
                hasFoundTracks={hasFoundTracks}
                onSyncComplete={() => {}}
              />
            )}

            {playlist.tracks.length > 0 && (
              <div className="ml-auto flex items-center gap-2">
                {playlist.confirmClear ? (
                  <>
                    <span className="text-xs text-zinc-500">Clear all tracks?</span>
                    <button onClick={handleClearPlaylist} className="rounded-lg bg-red-600/90 hover:bg-red-500 px-2.5 py-1 text-xs font-medium text-white cursor-pointer">
                      Yes, clear
                    </button>
                    <button onClick={() => playlist.setConfirmClear(false)} className="rounded-lg bg-zinc-800 hover:bg-zinc-700 px-2.5 py-1 text-xs font-medium text-zinc-400 cursor-pointer">
                      Cancel
                    </button>
                  </>
                ) : (
                  <button onClick={() => playlist.setConfirmClear(true)} className="text-xs text-zinc-500 hover:text-red-400 cursor-pointer">
                    Clear playlist
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Stats row */}
          {playlist.tracks.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold text-white tabular-nums">{playlist.tracks.length}</span>
              <span className="text-xs text-zinc-500">tracks</span>
              {foundCount > 0 && (
                <>
                  <span className="text-zinc-700 text-xs">·</span>
                  <span className="flex items-center gap-1.5 text-xs">
                    <CheckIcon className="w-3 h-3 text-emerald-400" />
                    <span className="font-semibold text-emerald-400 tabular-nums">{foundCount}</span>
                    <span className="text-zinc-500">ready to play</span>
                  </span>
                  {totalDurationSeconds > 0 && (
                    <>
                      <span className="text-zinc-700 text-xs">·</span>
                      <span className="text-xs text-zinc-500 tabular-nums">
                        {formatDuration(totalDurationSeconds)}
                      </span>
                    </>
                  )}
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
          {playlist.tracksLoading ? (
            <div className="space-y-1.5">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-[52px] rounded-xl bg-zinc-900/50 animate-pulse" style={{ opacity: 1 - i * 0.12 }} />
              ))}
            </div>
          ) : playlist.tracks.length === 0 ? (
            <PlaylistEmptyState
              gamesLength={gameLibrary.games.length}
              importUrl={playlist.importUrl}
              onImportUrlChange={(url) => { playlist.setImportUrl(url); }}
              importing={playlist.importing}
              importError={playlist.importError}
              onImport={handleImport}
            />
          ) : (
            <div className="flex flex-col gap-1.5 pb-24">
              {playlist.tracks.map((track, i) => {
                const effectiveIdx = player.effectiveFoundTracks.findIndex((ft) => ft.id === track.id);
                const isCurrentTrack = track.id === player.playingTrackId;
                return (
                  <PlaylistTrackCard
                    key={track.id}
                    track={track}
                    index={i}
                    vibe={gameVibeMap[track.game_id]}
                    isPlaying={isCurrentTrack}
                    isActivelyPlaying={isCurrentTrack && player.isPlayerPlaying}
                    onPlay={effectiveIdx !== -1 ? () => {
                      if (isCurrentTrack) {
                        player.playerBarRef.current?.togglePlayPause();
                      } else {
                        player.setCurrentTrackIndex(effectiveIdx);
                      }
                    } : undefined}
                  />
                );
              })}
            </div>
          )}
        </main>
      </div>

    </>
  );
}
