"use client";

import React, { createContext, useContext, useEffect, useMemo } from "react";
import { usePlaylist } from "@/hooks/usePlaylist";
import { usePlayerState } from "@/hooks/usePlayerState";
import { useConfig } from "@/hooks/useConfig";
import { useGameLibrary } from "@/hooks/useGameLibrary";
import { PlayerBar } from "@/components/PlayerBar";
import { steamHeaderUrl } from "@/lib/constants";

type PlaylistState = ReturnType<typeof usePlaylist>;
type PlayerState = ReturnType<typeof usePlayerState>;
type ConfigState = ReturnType<typeof useConfig>;
type GameLibraryState = ReturnType<typeof useGameLibrary>;

interface PlayerContextValue {
  playlist: PlaylistState;
  player: PlayerState;
  config: ConfigState;
  gameLibrary: GameLibraryState;
  /** Steam header image URL keyed by game ID. Computed once; use instead of re-deriving. */
  gameThumbnailByGameId: Map<string, string>;
}

const PlayerContext = createContext<PlayerContextValue | null>(null);

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const playlist = usePlaylist();
  const config = useConfig();
  const gameLibrary = useGameLibrary();

  const foundTracks = playlist.tracks.filter((t) => t.status === "found");
  const player = usePlayerState(foundTracks);
  const {
    playerBarRef,
    currentTrackIndex,
    effectiveFoundTracks,
    setCurrentTrackIndex,
    setIsPlayerPlaying,
    shuffleMode,
    handleToggleShuffle,
  } = player;

  const fetchTracks = playlist.fetchTracks;
  const fetchGames = gameLibrary.fetchGames;

  useEffect(() => {
    fetchTracks();
  }, [fetchTracks]);

  useEffect(() => {
    fetchGames();
  }, [fetchGames]);

  // Steam thumbnail map — computed once here, shared with all consumers via context.
  const gameThumbnailByGameId = useMemo(
    () =>
      new Map(
        gameLibrary.games
          .filter((g) => g.steam_appid != null)
          .map((g) => [g.id, steamHeaderUrl(g.steam_appid as number)]),
      ),
    [gameLibrary.games],
  );

  return (
    <PlayerContext.Provider
      value={{ playlist, player, config, gameLibrary, gameThumbnailByGameId }}
    >
      {children}
      {currentTrackIndex !== null && effectiveFoundTracks.length > 0 && (
        <PlayerBar
          ref={playerBarRef}
          tracks={effectiveFoundTracks}
          currentIndex={currentTrackIndex}
          onIndexChange={setCurrentTrackIndex}
          onPlayingChange={setIsPlayerPlaying}
          shuffleMode={shuffleMode}
          onToggleShuffle={foundTracks.length > 0 ? handleToggleShuffle : undefined}
          gameThumbnailByGameId={gameThumbnailByGameId}
        />
      )}
    </PlayerContext.Provider>
  );
}

export function usePlayerContext(): PlayerContextValue {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error("usePlayerContext must be used within PlayerProvider");
  return ctx;
}
