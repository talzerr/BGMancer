"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import type { PlaylistTrack } from "@/types";
import type { PlayerBarHandle } from "@/components/player/PlayerBar";

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
  const playerBarRef = useRef<PlayerBarHandle | null>(null);

  /** Start playing a set of tracks from a given index */
  function startPlaying(tracks: PlaylistTrack[], index: number, sessionId: string | null) {
    setPlayingTracks(tracks);
    setPlayingSessionId(sessionId);
    setCurrentTrackIndex(index);
    setShuffleMode(false);
    setShuffleOrder([]);
    setPlayedTrackIds(new Set());
  }

  function reset() {
    setCurrentTrackIndex(null);
    setShuffleMode(false);
    setShuffleOrder([]);
    setPlayedTrackIds(new Set());
    setPlayingTracks([]);
    setPlayingSessionId(null);
  }

  const clearPlayedTracks = useCallback(() => {
    setPlayedTrackIds(new Set());
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
          return next;
        });
      }
    }
    // effectiveFoundTracks is intentionally omitted: we only want to mark a track
    // as played when the *index* changes (i.e. the user or auto-advance moves to a
    // new track), not on every playlist mutation (reorder, delete, etc.).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTrackIndex]);

  return {
    currentTrackIndex,
    setCurrentTrackIndex,
    isPlayerPlaying,
    setIsPlayerPlaying,
    shuffleMode,
    handleToggleShuffle,
    playerBarRef,
    reset,
    startPlaying,
    clearPlayedTracks,
    effectiveFoundTracks,
    playingTrackId,
    playingSessionId,
    activeGameId,
    playedTrackIds,
  };
}
