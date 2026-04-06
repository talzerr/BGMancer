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

  const [restoredSeekSeconds, setRestoredSeekSeconds] = useState<number | null>(null);
  const cacheRestoredRef = useRef(false);

  const fetchTracks = playlist.fetchTracks;
  const fetchGames = gameLibrary.fetchGames;
  const clearPlayedTracks = player.clearPlayedTracks;

  // Hydrate from localStorage cache instantly on mount; server fetch refreshes in background
  useEffect(() => {
    if (!isSignedIn || cacheRestoredRef.current) return;
    cacheRestoredRef.current = true;

    const saved = readPlaybackState();
    const cachedTracks = readPlaybackTracks();
    if (!saved || !cachedTracks) return;

    const track = cachedTracks[saved.trackIndex];
    if (!track || track.video_id !== saved.videoId) return;

    playlist.hydrateFromCache(cachedTracks, saved.sessionId);
    player.restorePlayback(cachedTracks, saved.trackIndex, saved.sessionId);
    setRestoredSeekSeconds(saved.positionSeconds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSignedIn]);

  useEffect(() => {
    fetchTracks();
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
