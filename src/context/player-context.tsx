"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { usePlaylist } from "@/hooks/player/usePlaylist";
import { usePlayerState } from "@/hooks/player/usePlayerState";
import { useConfig } from "@/hooks/config/useConfig";
import { useGameLibrary } from "@/hooks/library/useGameLibrary";
import { PlayerBar } from "@/components/player/PlayerBar";
import type { Game, PlaylistTrack } from "@/types";
import {
  readPlaybackState,
  readPlaybackTracks,
  savePlaybackState,
  savePlaybackTracks,
} from "@/hooks/player/playback-state";

type PlaylistState = ReturnType<typeof usePlaylist>;
type PlayerState = ReturnType<typeof usePlayerState>;
type ConfigState = ReturnType<typeof useConfig>;
type GameLibraryState = ReturnType<typeof useGameLibrary>;

interface PlayerContextValue {
  playlist: PlaylistState;
  player: PlayerState;
  config: ConfigState;
  gameLibrary: GameLibraryState;
  gameThumbnailByGameId: Map<string, string>;
  isSignedIn: boolean;
  toggleAntiSpoiler: () => void;
}

const PlayerContext = createContext<PlayerContextValue | null>(null);

export function PlayerProvider({
  children,
  isSignedIn,
  initialGames = [],
  initialTracks = [],
  initialSessionId = null,
}: {
  children: React.ReactNode;
  isSignedIn: boolean;
  initialGames?: Game[];
  initialTracks?: PlaylistTrack[];
  initialSessionId?: string | null;
}) {
  const playlist = usePlaylist({ initialTracks, initialSessionId });
  const config = useConfig();
  const gameLibrary = useGameLibrary(isSignedIn, initialGames);

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

  const [restoredSeekSeconds, setRestoredSeekSeconds] = useState<number | null>(null);
  const cacheRestoredRef = useRef(false);
  const restoredSessionIdRef = useRef<string | null>(null);

  const fetchTracks = playlist.fetchTracks;
  const fetchGames = gameLibrary.fetchGames;
  const clearPlayedTracks = player.clearPlayedTracks;

  useEffect(() => {
    if (!isSignedIn || cacheRestoredRef.current) return;
    cacheRestoredRef.current = true;

    const saved = readPlaybackState();
    const cachedTracks = readPlaybackTracks();
    if (!saved || !cachedTracks) return;

    const track = cachedTracks[saved.trackIndex];
    if (!track || track.video_id !== saved.videoId) return;

    restoredSessionIdRef.current = saved.sessionId;
    playlist.hydrateFromCache(cachedTracks, saved.sessionId);
    player.restorePlayback(cachedTracks, saved.trackIndex, saved.sessionId);
    setRestoredSeekSeconds(saved.positionSeconds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSignedIn]);

  useEffect(() => {
    fetchTracks(restoredSessionIdRef.current ?? undefined);
  }, [fetchTracks]);

  useEffect(() => {
    fetchGames();
  }, [fetchGames]);

  useEffect(() => {
    if (restoredSeekSeconds !== null) setRestoredSeekSeconds(null);
  }, [restoredSeekSeconds]);

  const handleTimeUpdate = useCallback(
    (time: number) => {
      const idx = player.currentTrackIndex;
      const sessionId = player.playingSessionId;
      if (idx === null || !sessionId) return;
      const track = player.effectiveFoundTracks[idx];
      if (!track?.video_id) return;
      savePlaybackState({
        sessionId,
        trackIndex: idx,
        positionSeconds: time,
        videoId: track.video_id,
      });
    },
    [player.currentTrackIndex, player.playingSessionId, player.effectiveFoundTracks],
  );

  useEffect(() => {
    if (restoredSeekSeconds !== null) return;
    const idx = player.currentTrackIndex;
    const sessionId = player.playingSessionId;
    if (idx === null || !sessionId) return;
    const track = player.effectiveFoundTracks[idx];
    if (!track?.video_id) return;
    savePlaybackState({ sessionId, trackIndex: idx, positionSeconds: 0, videoId: track.video_id });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player.currentTrackIndex, player.playingSessionId]);

  useEffect(() => {
    if (playlist.tracks.length > 0 && playlist.currentSessionId) {
      savePlaybackTracks(playlist.tracks);
    }
  }, [playlist.tracks, playlist.currentSessionId]);

  const toggleAntiSpoiler = useCallback(() => {
    const enabling = !config.antiSpoilerEnabled;
    config.saveAntiSpoiler(enabling);
    if (enabling) clearPlayedTracks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.antiSpoilerEnabled, config.saveAntiSpoiler, clearPlayedTracks]);

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
      value={{
        playlist,
        player,
        config,
        gameLibrary,
        gameThumbnailByGameId,
        isSignedIn,
        toggleAntiSpoiler,
      }}
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
          startPaused={restoredSeekSeconds !== null}
          initialSeekSeconds={restoredSeekSeconds ?? undefined}
          onTimeUpdate={handleTimeUpdate}
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
