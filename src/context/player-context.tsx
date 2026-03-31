"use client";

import React, { createContext, useContext, useEffect, useMemo } from "react";
import { usePlaylist } from "@/hooks/usePlaylist";
import { usePlayerState } from "@/hooks/usePlayerState";
import { useConfig } from "@/hooks/useConfig";
import { useGameLibrary } from "@/hooks/useGameLibrary";
import { PlayerBar } from "@/components/PlayerBar";

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.antiSpoilerEnabled]);

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
