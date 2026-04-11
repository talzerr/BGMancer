"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import type { PlaylistTrack } from "@/types";
import {
  clearPlaybackState,
  saveRevealedTracks,
  readRevealedTracks,
  clearRevealedTracks,
} from "@/hooks/player/playback-state";

export function usePlayerState() {
  const [currentTrackIndex, setCurrentTrackIndex] = useState<number | null>(null);
  const [isPlayerPlaying, setIsPlayerPlaying] = useState(false);
  const [playedTrackIds, setPlayedTrackIds] = useState<Set<string>>(new Set());
  /** Snapshot of tracks when playback started — decoupled from viewed playlist */
  const [playingTracks, setPlayingTracks] = useState<PlaylistTrack[]>([]);
  /** Session ID that is currently playing (may differ from viewed session) */
  const [playingSessionId, setPlayingSessionId] = useState<string | null>(null);
  /** Start playing a set of tracks from a given index */
  function startPlaying(tracks: PlaylistTrack[], index: number, sessionId: string | null) {
    if (sessionId !== null && playingSessionId !== null && sessionId !== playingSessionId) {
      setPlayedTrackIds(new Set());
      clearRevealedTracks();
    }
    setPlayingTracks(tracks);
    setPlayingSessionId(sessionId);
    setCurrentTrackIndex(index);
  }

  function reset() {
    setCurrentTrackIndex(null);
    setPlayedTrackIds(new Set());
    setPlayingTracks([]);
    setPlayingSessionId(null);
    clearPlaybackState();
  }

  /** Stop playback without clearing localStorage cache (used after generation). */
  function resetPlayback() {
    setCurrentTrackIndex(null);
    setPlayedTrackIds(new Set());
    setPlayingTracks([]);
    setPlayingSessionId(null);
  }

  function restorePlayback(tracks: PlaylistTrack[], index: number, sessionId: string | null) {
    const revealed = readRevealedTracks();
    setPlayingTracks(tracks);
    setPlayingSessionId(sessionId);
    setCurrentTrackIndex(index);
    setPlayedTrackIds(revealed);
  }

  const clearPlayedTracks = useCallback(() => {
    const currentId = playingTrackIdRef.current;
    if (currentId) {
      const preserved = new Set([currentId]);
      setPlayedTrackIds(preserved);
      saveRevealedTracks(preserved);
    } else {
      setPlayedTrackIds(new Set());
      clearRevealedTracks();
    }
  }, []);

  const playingTrackId =
    currentTrackIndex !== null ? (playingTracks[currentTrackIndex]?.id ?? null) : null;
  const playingTrackIdRef = useRef(playingTrackId);
  useEffect(() => {
    playingTrackIdRef.current = playingTrackId;
  }, [playingTrackId]);

  const activeGameId =
    currentTrackIndex !== null ? (playingTracks[currentTrackIndex]?.game_id ?? null) : null;

  // Mark current track as played whenever the index changes
  useEffect(() => {
    if (currentTrackIndex !== null) {
      const track = playingTracks[currentTrackIndex];
      if (track) {
        setPlayedTrackIds((prev) => {
          if (prev.has(track.id)) return prev;
          const next = new Set(prev);
          next.add(track.id);
          saveRevealedTracks(next);
          return next;
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTrackIndex]);

  return {
    currentTrackIndex,
    setCurrentTrackIndex,
    isPlayerPlaying,
    setIsPlayerPlaying,
    reset,
    resetPlayback,
    startPlaying,
    restorePlayback,
    clearPlayedTracks,
    playingTracks,
    playingTrackId,
    playingSessionId,
    activeGameId,
    playedTrackIds,
  };
}
