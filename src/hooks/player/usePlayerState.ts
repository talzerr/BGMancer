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
  const [shuffleMode, setShuffleMode] = useState(false);
  const [shuffleOrder, setShuffleOrder] = useState<number[]>([]);
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
    setShuffleMode(false);
    setShuffleOrder([]);
  }

  function reset() {
    setCurrentTrackIndex(null);
    setShuffleMode(false);
    setShuffleOrder([]);
    setPlayedTrackIds(new Set());
    setPlayingTracks([]);
    setPlayingSessionId(null);
    clearPlaybackState();
  }

  /** Stop playback without clearing localStorage cache (used after generation). */
  function resetPlayback() {
    setCurrentTrackIndex(null);
    setShuffleMode(false);
    setShuffleOrder([]);
    setPlayedTrackIds(new Set());
    setPlayingTracks([]);
    setPlayingSessionId(null);
  }

  function restorePlayback(tracks: PlaylistTrack[], index: number, sessionId: string | null) {
    const revealed = readRevealedTracks();
    setPlayingTracks(tracks);
    setPlayingSessionId(sessionId);
    setCurrentTrackIndex(index);
    setShuffleMode(false);
    setShuffleOrder([]);
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

  function handleToggleShuffle() {
    const cur = currentTrackIndex ?? 0;
    if (shuffleMode) {
      const actualIdx = shuffleOrder[cur] ?? 0;
      setShuffleMode(false);
      setShuffleOrder([]);
      setCurrentTrackIndex(actualIdx);
    } else {
      // Fisher-Yates shuffle; keep current track at position 0
      const indices = Array.from({ length: playingTracks.length }, (_, i) => i);
      for (let i = indices.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [indices[i], indices[j]] = [indices[j], indices[i]];
      }
      const curPos = indices.indexOf(cur);
      [indices[0], indices[curPos]] = [indices[curPos], indices[0]];
      setShuffleOrder(indices);
      setShuffleMode(true);
      setCurrentTrackIndex(0);
    }
  }

  const effectiveFoundTracks =
    shuffleMode && shuffleOrder.length === playingTracks.length
      ? shuffleOrder.map((i) => playingTracks[i]).filter(Boolean)
      : playingTracks;

  const playingTrackId =
    currentTrackIndex !== null ? (effectiveFoundTracks[currentTrackIndex]?.id ?? null) : null;
  const playingTrackIdRef = useRef(playingTrackId);
  useEffect(() => {
    playingTrackIdRef.current = playingTrackId;
  }, [playingTrackId]);

  const activeGameId =
    currentTrackIndex !== null ? (effectiveFoundTracks[currentTrackIndex]?.game_id ?? null) : null;

  // Mark current track as played whenever the index changes (must be after effectiveFoundTracks)
  useEffect(() => {
    if (currentTrackIndex !== null) {
      const track = effectiveFoundTracks[currentTrackIndex];
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
    shuffleMode,
    handleToggleShuffle,
    reset,
    resetPlayback,
    startPlaying,
    restorePlayback,
    clearPlayedTracks,
    effectiveFoundTracks,
    playingTrackId,
    playingSessionId,
    activeGameId,
    playedTrackIds,
  };
}
