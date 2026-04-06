"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { usePlaylist } from "@/hooks/player/usePlaylist";
import { usePlayerState } from "@/hooks/player/usePlayerState";
import { useConfig } from "@/hooks/config/useConfig";
import { useGameLibrary } from "@/hooks/library/useGameLibrary";
import { PlayerBar } from "@/components/player/PlayerBar";
import {
  readPlaybackState,
  savePlaybackState,
  type SavedPlaybackState,
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

  // ─── Playback restore ────────────────────────────────────────────────────────
  const [pendingRestore, setPendingRestore] = useState<SavedPlaybackState | null>(null);
  const [restoredSeekSeconds, setRestoredSeekSeconds] = useState<number | null>(null);

  const fetchTracks = playlist.fetchTracks;
  const fetchGames = gameLibrary.fetchGames;
  const clearPlayedTracks = player.clearPlayedTracks;

  // Read saved playback state once on mount (signed-in users only)
  useEffect(() => {
    if (!isSignedIn) return;
    const saved = readPlaybackState();
    if (saved) setPendingRestore(saved);
  }, [isSignedIn]);

  useEffect(() => {
    fetchTracks();
  }, [fetchTracks]);

  useEffect(() => {
    fetchGames();
  }, [fetchGames]);

  // Apply restore once the correct session's tracks have loaded
  useEffect(() => {
    if (!pendingRestore || playlist.isLoading) return;

    // If the loaded session doesn't match, load the saved one
    if (pendingRestore.sessionId !== playlist.currentSessionId) {
      playlist.loadForSession(pendingRestore.sessionId);
      return;
    }

    // Validate the track at the saved index still matches
    const track = playlist.tracks[pendingRestore.trackIndex];
    if (track && track.video_id === pendingRestore.videoId) {
      player.restorePlayback(playlist.tracks, pendingRestore.trackIndex, pendingRestore.sessionId);
      setRestoredSeekSeconds(pendingRestore.positionSeconds);
    }

    setPendingRestore(null);
    // playlist.loadForSession is stable (useCallback). player.restorePlayback is a plain
    // function that only reads setState closures, so omitting it avoids stale-closure issues
    // without causing missed updates — the effect re-runs when pendingRestore or isLoading change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingRestore, playlist.isLoading, playlist.currentSessionId, playlist.tracks]);

  // Clear restoredSeekSeconds after PlayerBar has consumed it (one render later)
  useEffect(() => {
    if (restoredSeekSeconds !== null) setRestoredSeekSeconds(null);
  }, [restoredSeekSeconds]);

  // Save playback position periodically (~5s via onTimeUpdate from PlayerBar)
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

  // Save on track change (position 0) to catch rapid skips
  useEffect(() => {
    const idx = player.currentTrackIndex;
    const sessionId = player.playingSessionId;
    if (idx === null || !sessionId) return;
    const track = player.effectiveFoundTracks[idx];
    if (!track?.video_id) return;
    savePlaybackState({ sessionId, trackIndex: idx, positionSeconds: 0, videoId: track.video_id });
    // effectiveFoundTracks omitted: save should fire on index change, not playlist mutations
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player.currentTrackIndex, player.playingSessionId]);

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
