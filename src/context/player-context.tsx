"use client";

import React, { createContext, useContext, useEffect, useMemo } from "react";
import { usePlaylist } from "@/hooks/player/usePlaylist";
import { usePlayerState } from "@/hooks/player/usePlayerState";
import { useConfig } from "@/hooks/config/useConfig";
import { useGameLibrary } from "@/hooks/library/useGameLibrary";
import { PlayerBar } from "@/components/player/PlayerBar";

type PlaylistState = ReturnType<typeof usePlaylist>;
type PlayerState = ReturnType<typeof usePlayerState>;
type ConfigState = ReturnType<typeof useConfig>;
type GameLibraryState = ReturnType<typeof useGameLibrary>;

interface PlayerContextValue {
  playlist: PlaylistState;
  player: PlayerState;
  config: ConfigState;
  gameLibrary: GameLibraryState;
  /** Game thumbnail URL keyed by game ID. Computed once; use instead of re-deriving. */
  gameThumbnailByGameId: Map<string, string>;
  isSignedIn: boolean;
}

const PlayerContext = createContext<PlayerContextValue | null>(null);

export function PlayerProvider({
  children,
  isSignedIn,
}: {
  children: React.ReactNode;
  isSignedIn: boolean;
}) {
  const playlist = usePlaylist();
  const config = useConfig();
  const gameLibrary = useGameLibrary(isSignedIn);

  const player = usePlayerState();
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
  const clearPlayedTracks = player.clearPlayedTracks;

  useEffect(() => {
    fetchTracks();
  }, [fetchTracks]);

  useEffect(() => {
    fetchGames();
  }, [fetchGames]);

  // Re-blur all tracks when anti-spoiler is re-enabled
  useEffect(() => {
    if (config.antiSpoilerEnabled) {
      clearPlayedTracks();
    }
  }, [config.antiSpoilerEnabled, clearPlayedTracks]);

  // Game thumbnail map — built from playlist tracks so skipped games are included.
  // Each track carries game_thumbnail_url via JOIN, so no extra fetch is needed.
  const gameThumbnailByGameId = useMemo(() => {
    const map = new Map<string, string>();
    for (const track of playlist.tracks) {
      if (track.game_thumbnail_url && !map.has(track.game_id)) {
        map.set(track.game_id, track.game_thumbnail_url);
      }
    }
    return map;
  }, [playlist.tracks]);

  return (
    <PlayerContext.Provider
      value={{ playlist, player, config, gameLibrary, gameThumbnailByGameId, isSignedIn }}
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
          onToggleShuffle={effectiveFoundTracks.length > 0 ? handleToggleShuffle : undefined}
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
