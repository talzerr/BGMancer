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
import { useYouTubePlayer } from "@/hooks/player/useYouTubePlayer";
import type { Game, PlaylistTrack } from "@/types";
import {
  readPlaybackState,
  readPlaybackTracks,
  clearPlaybackState,
  savePlaybackState,
  savePlaybackTracks,
} from "@/hooks/player/playback-state";
import { clearGuestLibrary } from "@/lib/guest-library";
import { GUEST_SESSION_ID } from "@/lib/constants";

type PlaylistState = ReturnType<typeof usePlaylist>;
type PlayerState = ReturnType<typeof usePlayerState>;
type ConfigState = ReturnType<typeof useConfig>;
type GameLibraryState = ReturnType<typeof useGameLibrary>;

export interface MediaState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  dimmed: boolean;
  togglePlayPause: () => void;
  seekTo: (seconds: number) => void;
  applyVolume: (v: number) => void;
  toggleDim: () => void;
}

interface PlayerContextValue {
  playlist: PlaylistState;
  player: PlayerState;
  config: ConfigState;
  gameLibrary: GameLibraryState;
  gameThumbnailByGameId: Map<string, string>;
  isSignedIn: boolean;
  toggleAntiSpoiler: () => void;
  media: MediaState | null;
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
  // ── Unified restore ──
  // Pure read of cached tracks and playback state — no side effects.
  // For signed-in users: only restores own session cache (skips guest data).
  // For guests: restores tracks (always) and playback state (if valid).
  const restoreData = useMemo(() => {
    if (isSignedIn) {
      const saved = readPlaybackState();
      if (!saved || saved.sessionId === GUEST_SESSION_ID) {
        return { tracks: null, playback: null, clearGuest: true, clearPlayback: true };
      }
      const cachedTracks = readPlaybackTracks();
      if (!cachedTracks) return { tracks: null, playback: null, clearGuest: true };
      const track = cachedTracks[saved.trackIndex];
      if (!track || track.video_id !== saved.videoId) {
        return { tracks: null, playback: null, clearGuest: true };
      }
      return { tracks: cachedTracks, playback: saved, clearGuest: true };
    }

    const cachedTracks = readPlaybackTracks();
    if (!cachedTracks || cachedTracks.length === 0) return { tracks: null, playback: null };
    const saved = readPlaybackState();
    if (saved) {
      const track = cachedTracks[saved.trackIndex];
      if (track && track.video_id === saved.videoId) {
        return { tracks: cachedTracks, playback: saved };
      }
    }
    return { tracks: cachedTracks, playback: null };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const playlist = usePlaylist({
    initialTracks: restoreData.tracks ?? initialTracks,
    initialSessionId: restoreData.tracks
      ? (restoreData.playback?.sessionId ?? GUEST_SESSION_ID)
      : initialSessionId,
  });
  const config = useConfig();
  const gameLibrary = useGameLibrary(isSignedIn, initialGames);

  const player = usePlayerState();
  const { currentTrackIndex, playingTracks, setCurrentTrackIndex, setIsPlayerPlaying } = player;

  const [restoredSeekSeconds, setRestoredSeekSeconds] = useState<number | null>(
    restoreData.playback?.positionSeconds ?? null,
  );
  const startPausedOnRestore = restoreData.playback?.paused ?? true;

  const restoredSessionIdRef = useRef<string | null>(null);
  const restoredRef = useRef(false);
  const fetchTracks = playlist.fetchTracks;
  const fetchGames = gameLibrary.fetchGames;
  const clearPlayedTracks = player.clearPlayedTracks;

  // Clean up stale localStorage on mount (side effects from restoreData).
  useEffect(() => {
    if (restoreData.clearGuest) clearGuestLibrary();
    if (restoreData.clearPlayback) clearPlaybackState();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Restore playback position if cached state exists.
  useEffect(() => {
    if (restoredRef.current || !restoreData.playback || !restoreData.tracks) return;
    restoredRef.current = true;
    restoredSessionIdRef.current = restoreData.playback.sessionId;
    if (isSignedIn) {
      playlist.hydrateFromCache(restoreData.tracks, restoreData.playback.sessionId);
    }
    player.restorePlayback(
      restoreData.tracks,
      restoreData.playback.trackIndex,
      restoreData.playback.sessionId,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!isSignedIn) return;
    fetchTracks(restoredSessionIdRef.current ?? undefined);
  }, [isSignedIn, fetchTracks]);

  useEffect(() => {
    fetchGames();
  }, [fetchGames]);

  // When generation completes, stop old playback so the player doesn't keep
  // playing a track from the previous session. Uses resetPlayback (not reset)
  // to preserve the localStorage track cache for guest refresh persistence.
  const generatingRef = useRef(false);
  useEffect(() => {
    if (generatingRef.current && !playlist.generating) {
      player.resetPlayback();
    }
    generatingRef.current = playlist.generating;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playlist.generating]);

  useEffect(() => {
    if (restoredSeekSeconds !== null) setRestoredSeekSeconds(null);
  }, [restoredSeekSeconds]);

  const handleTimeUpdate = useCallback(
    (time: number, paused: boolean) => {
      const idx = player.currentTrackIndex;
      const sessionId = player.playingSessionId ?? GUEST_SESSION_ID;
      if (idx === null) return;
      const track = player.playingTracks[idx];
      if (!track?.video_id) return;
      savePlaybackState({
        sessionId,
        trackIndex: idx,
        positionSeconds: time,
        videoId: track.video_id,
        paused,
      });
    },
    [player.currentTrackIndex, player.playingSessionId, player.playingTracks],
  );

  useEffect(() => {
    if (restoredSeekSeconds !== null) return;
    const idx = player.currentTrackIndex;
    const sessionId = player.playingSessionId ?? GUEST_SESSION_ID;
    if (idx === null) return;
    const track = player.playingTracks[idx];
    if (!track?.video_id) return;
    savePlaybackState({ sessionId, trackIndex: idx, positionSeconds: 0, videoId: track.video_id });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player.currentTrackIndex, player.playingSessionId]);

  useEffect(() => {
    if (playlist.tracks.length > 0) {
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

  // ── YouTube player ──
  const hasActiveTrack = currentTrackIndex !== null && playingTracks.length > 0;

  const ytPlayer = useYouTubePlayer({
    tracks: hasActiveTrack ? playingTracks : [],
    currentIndex: currentTrackIndex ?? 0,
    onIndexChange: setCurrentTrackIndex,
    onPlayingChange: setIsPlayerPlaying,
    startPaused: restoredSeekSeconds !== null && startPausedOnRestore,
    initialSeekSeconds: restoredSeekSeconds ?? undefined,
    onTimeUpdate: handleTimeUpdate,
    enabled: hasActiveTrack,
  });

  const media: MediaState | null = useMemo(
    () =>
      hasActiveTrack
        ? {
            isPlaying: ytPlayer.isPlaying,
            currentTime: ytPlayer.currentTime,
            duration: ytPlayer.duration,
            volume: ytPlayer.volume,
            dimmed: ytPlayer.dimmed,
            togglePlayPause: ytPlayer.togglePlayPause,
            seekTo: ytPlayer.seekTo,
            applyVolume: ytPlayer.applyVolume,
            toggleDim: ytPlayer.toggleDim,
          }
        : null,
    [
      hasActiveTrack,
      ytPlayer.isPlaying,
      ytPlayer.currentTime,
      ytPlayer.duration,
      ytPlayer.volume,
      ytPlayer.dimmed,
      ytPlayer.togglePlayPause,
      ytPlayer.seekTo,
      ytPlayer.applyVolume,
      ytPlayer.toggleDim,
    ],
  );

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
        media,
      }}
    >
      {children}
    </PlayerContext.Provider>
  );
}

export function usePlayerContext(): PlayerContextValue {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error("usePlayerContext must be used within PlayerProvider");
  return ctx;
}
