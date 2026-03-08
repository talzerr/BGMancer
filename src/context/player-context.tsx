"use client";

import React, { createContext, useContext, useEffect, useCallback } from "react";
import { usePlaylist } from "@/hooks/usePlaylist";
import { usePlayerState } from "@/hooks/usePlayerState";
import { PlayerBar } from "@/components/PlayerBar";

type PlaylistState = ReturnType<typeof usePlaylist>;
type PlayerState = ReturnType<typeof usePlayerState>;

interface PlayerContextValue {
  playlist: PlaylistState;
  player: PlayerState;
}

const PlayerContext = createContext<PlayerContextValue | null>(null);

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const playlist = usePlaylist();
  const foundTracks = playlist.tracks.filter((t) => t.status === "found");
  const player = usePlayerState(foundTracks);

  const fetchTracks = playlist.fetchTracks;
  useEffect(() => {
    fetchTracks();
  }, [fetchTracks]);

  return (
    <PlayerContext.Provider value={{ playlist, player }}>
      {children}
      {player.currentTrackIndex !== null && player.effectiveFoundTracks.length > 0 && (
        <PlayerBar
          ref={player.playerBarRef}
          tracks={player.effectiveFoundTracks}
          currentIndex={player.currentTrackIndex}
          onIndexChange={player.setCurrentTrackIndex}
          onClose={() => player.setCurrentTrackIndex(null)}
          onPlayingChange={player.setIsPlayerPlaying}
          shuffleMode={player.shuffleMode}
          onToggleShuffle={foundTracks.length > 0 ? player.handleToggleShuffle : undefined}
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
