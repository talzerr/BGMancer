"use client";

import { useEffect, useState, useCallback } from "react";
import type { SyntheticEvent } from "react";
import Link from "next/link";
import { useGameLibrary } from "@/hooks/useGameLibrary";
import { useConfig } from "@/hooks/useConfig";
import { usePlayerContext } from "@/context/player-context";
import { GenerateSection } from "@/components/GenerateSection";
import { PlaylistTrackCard } from "@/components/PlaylistTrackCard";
import { PlaylistEmptyState } from "@/components/PlaylistEmptyState";
import { SyncButton } from "@/components/SyncButton";
import { DevPanel } from "@/components/DevPanel";
import { Spinner, SearchIcon, CheckIcon, EyeIcon, EyeOffIcon } from "@/components/Icons";

interface FeedClientProps {
  isSignedIn: boolean;
  authConfigured: boolean;
}

export function FeedClient({ isSignedIn, authConfigured }: FeedClientProps) {
  const gameLibrary = useGameLibrary();
  const config = useConfig();
  const { playlist, player } = usePlayerContext();
  const [playedTrackIds, setPlayedTrackIds] = useState<Set<string>>(new Set());

  const markPlayed = useCallback((id: string) => {
    setPlayedTrackIds((prev) => (prev.has(id) ? prev : new Set(prev).add(id)));
  }, []);

  // Initial data fetch — playlist is already fetched by PlayerProvider on mount;
  // we only need to refresh games here.
  const { fetchGames } = gameLibrary;
  useEffect(() => {
    fetchGames();
  }, [fetchGames]);

  // ── Cross-hook action coordinators ──────────────────────────────────────────

  async function handleGenerate() {
    player.reset();
    setPlayedTrackIds(new Set());
    await playlist.handleGenerate(gameLibrary.games);
  }

  async function handleClearPlaylist() {
    await playlist.handleClearPlaylist();
    player.reset();
    setPlayedTrackIds(new Set());
  }

  async function handleImport(e: SyntheticEvent<HTMLFormElement>) {
    const success = await playlist.handleImport(e);
    if (success) {
      player.reset();
      setPlayedTrackIds(new Set());
    }
  }

  // ── Derived values ───────────────────────────────────────────────────────────

  const pendingCount = playlist.tracks.filter((t) => t.status === "pending").length;
  const foundCount = playlist.tracks.filter((t) => t.status === "found").length;
  const errorCount = playlist.tracks.filter((t) => t.status === "error").length;
  const hasFoundTracks = foundCount > 0;

  const gameThumbnailByGameId = new Map(
    gameLibrary.games
      .filter((g) => g.steam_appid)
      .map((g) => [
        g.id,
        `https://cdn.akamai.steamstatic.com/steam/apps/${g.steam_appid}/header.jpg`,
      ]),
  );

  const playingGameTitle =
    playlist.tracks.find((t) => t.id === player.playingTrackId)?.game_title ?? null;

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
      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[340px_1fr]">
        {/* ── Left panel ──────────────────────────────────────────────────── */}
        <aside className="flex flex-col gap-4 lg:sticky lg:top-20">
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

          <Link
            href="/library"
            className="group block rounded-2xl border border-white/[0.07] bg-zinc-900/70 p-4 shadow-lg shadow-black/40 backdrop-blur-sm transition-all hover:border-white/[0.14] hover:bg-zinc-900/90"
          >
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm font-semibold text-white tabular-nums">
                  {gameLibrary.games.length}
                </span>
                <span className="ml-1.5 text-sm text-zinc-500">
                  active game{gameLibrary.games.length !== 1 ? "s" : ""}
                </span>
              </div>
              <span className="text-xs font-medium text-zinc-600 transition-colors group-hover:text-teal-400">
                Manage Library →
              </span>
            </div>

            {/* Game cover avatars */}
            {gameLibrary.games.length > 0 && (
              <div className="mt-3 flex items-center">
                <div className="flex -space-x-2">
                  {gameLibrary.games.slice(0, 5).map((game) => (
                    <div
                      key={game.id}
                      className="h-7 w-7 shrink-0 overflow-hidden rounded-full border-2 border-zinc-900 bg-zinc-800 ring-0"
                    >
                      {game.steam_appid ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={`https://cdn.akamai.steamstatic.com/steam/apps/${game.steam_appid}/header.jpg`}
                          alt={game.title}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-zinc-700">
                          <span className="text-[9px] font-bold text-zinc-400 uppercase">
                            {game.title.charAt(0)}
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                {gameLibrary.games.length > 5 && (
                  <span className="ml-2 text-[11px] text-zinc-500 tabular-nums">
                    +{gameLibrary.games.length - 5} more
                  </span>
                )}
              </div>
            )}

            {playingGameTitle && (
              <div className="mt-2.5 flex items-center gap-2">
                <span className="relative flex h-2 w-2 shrink-0">
                  {player.isPlayerPlaying && (
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-violet-400 opacity-75" />
                  )}
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-violet-500" />
                </span>
                <span className="truncate text-xs">
                  <span className="text-zinc-600">From </span>
                  <span className="font-medium text-zinc-300">{playingGameTitle}</span>
                </span>
              </div>
            )}
            {!gameLibrary.gamesLoading && gameLibrary.games.length === 0 && (
              <p className="mt-2 text-xs text-zinc-600">
                No active games — add and enable some to get started.
              </p>
            )}
          </Link>
        </aside>

        {/* ── Right panel: Playlist ────────────────────────────────────────── */}
        <main className="flex flex-col gap-4">
          {/* Action bar */}
          <div className="flex flex-wrap items-center gap-2">
            {pendingCount > 0 && (
              <button
                onClick={playlist.handleFindVideos}
                disabled={playlist.searching}
                className="flex cursor-pointer items-center gap-2 rounded-xl border border-white/[0.06] bg-zinc-800/80 px-4 py-2.5 text-sm font-semibold text-zinc-300 hover:bg-zinc-700/80 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {playlist.searching ? (
                  <>
                    <Spinner className="h-3.5 w-3.5" />
                    Searching…
                  </>
                ) : (
                  <>
                    <SearchIcon className="h-3.5 w-3.5 text-amber-400" />
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
                {/* Anti-spoiler toggle */}
                <button
                  onClick={() => config.saveAntiSpoiler(!config.antiSpoilerEnabled)}
                  title={
                    config.antiSpoilerEnabled
                      ? "Anti-Spoiler: On — click to disable"
                      : "Anti-Spoiler: Off — click to enable"
                  }
                  className={`flex cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors ${
                    config.antiSpoilerEnabled
                      ? "border-violet-500/40 bg-violet-900/40 text-violet-300 hover:bg-violet-900/60"
                      : "border-white/[0.06] bg-zinc-800/60 text-zinc-500 hover:border-white/[0.12] hover:text-zinc-300"
                  }`}
                >
                  {config.antiSpoilerEnabled ? (
                    <EyeOffIcon className="h-3.5 w-3.5" />
                  ) : (
                    <EyeIcon className="h-3.5 w-3.5" />
                  )}
                  Spoilers
                </button>

                {playlist.confirmClear ? (
                  <>
                    <span className="text-xs text-zinc-500">Clear all tracks?</span>
                    <button
                      onClick={handleClearPlaylist}
                      className="cursor-pointer rounded-lg bg-red-600/90 px-2.5 py-1 text-xs font-medium text-white hover:bg-red-500"
                    >
                      Yes, clear
                    </button>
                    <button
                      onClick={() => playlist.setConfirmClear(false)}
                      className="cursor-pointer rounded-lg bg-zinc-800 px-2.5 py-1 text-xs font-medium text-zinc-400 hover:bg-zinc-700"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => playlist.setConfirmClear(true)}
                    className="mr-1 cursor-pointer text-xs text-zinc-500 hover:text-red-400"
                  >
                    Clear playlist
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Stats row */}
          {playlist.tracks.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-white tabular-nums">
                {playlist.tracks.length}
              </span>
              <span className="text-xs text-zinc-500">tracks</span>
              {foundCount > 0 && (
                <>
                  <span className="text-xs text-zinc-700">·</span>
                  <span className="flex items-center gap-1.5 text-xs">
                    <CheckIcon className="h-3 w-3 text-emerald-400" />
                    <span className="font-semibold text-emerald-400 tabular-nums">
                      {foundCount}
                    </span>
                    <span className="text-zinc-500">ready to play</span>
                  </span>
                  {totalDurationSeconds > 0 && (
                    <>
                      <span className="text-xs text-zinc-700">·</span>
                      <span className="text-xs font-semibold text-zinc-300 tabular-nums">
                        {formatDuration(totalDurationSeconds)}
                      </span>
                    </>
                  )}
                </>
              )}
              {pendingCount > 0 && (
                <>
                  <span className="text-xs text-zinc-700">·</span>
                  <span className="flex items-center gap-1 text-xs">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />
                    <span className="font-semibold text-amber-400 tabular-nums">
                      {pendingCount}
                    </span>
                    <span className="text-zinc-500">pending</span>
                  </span>
                </>
              )}
              {errorCount > 0 && (
                <>
                  <span className="text-xs text-zinc-700">·</span>
                  <span className="flex items-center gap-1 text-xs">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-red-400" />
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
                <div
                  key={i}
                  className="h-[52px] animate-pulse rounded-xl bg-zinc-900/50"
                  style={{ opacity: 1 - i * 0.12 }}
                />
              ))}
            </div>
          ) : playlist.tracks.length === 0 ? (
            <PlaylistEmptyState
              gamesLength={gameLibrary.games.length}
              importUrl={playlist.importUrl}
              onImportUrlChange={(url) => {
                playlist.setImportUrl(url);
              }}
              importing={playlist.importing}
              importError={playlist.importError}
              onImport={handleImport}
            />
          ) : (
            <div className="flex flex-col gap-1.5 pb-24">
              {playlist.tracks.map((track, i) => {
                const effectiveIdx = player.effectiveFoundTracks.findIndex(
                  (ft) => ft.id === track.id,
                );
                const isCurrentTrack = track.id === player.playingTrackId;
                const spoilerHidden =
                  config.antiSpoilerEnabled &&
                  track.status === "found" &&
                  !playedTrackIds.has(track.id);
                return (
                  <PlaylistTrackCard
                    key={track.id}
                    track={track}
                    index={i}
                    gameThumbnail={gameThumbnailByGameId.get(track.game_id)}
                    isPlaying={isCurrentTrack}
                    isActivelyPlaying={isCurrentTrack && player.isPlayerPlaying}
                    spoilerHidden={spoilerHidden}
                    onPlay={
                      effectiveIdx !== -1
                        ? () => {
                            markPlayed(track.id);
                            if (isCurrentTrack) {
                              player.playerBarRef.current?.togglePlayPause();
                            } else {
                              player.setCurrentTrackIndex(effectiveIdx);
                            }
                          }
                        : undefined
                    }
                  />
                );
              })}
            </div>
          )}
        </main>
      </div>

      {/* ── Dev panel ───────────────────────────────────────────────────────── */}
      <DevPanel />
    </>
  );
}
