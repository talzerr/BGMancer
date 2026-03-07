"use client";

import { useRef, useState } from "react";
import type { PlaylistTrack } from "@/types";
import type { PlayerBarHandle } from "@/components/PlayerBar";

export function usePlayerState(foundTracks: PlaylistTrack[]) {
  const [currentTrackIndex, setCurrentTrackIndex] = useState<number | null>(null);
  const [isPlayerPlaying, setIsPlayerPlaying] = useState(false);
  const [shuffleMode, setShuffleMode] = useState(false);
  const [shuffleOrder, setShuffleOrder] = useState<number[]>([]);
  const playerBarRef = useRef<PlayerBarHandle | null>(null);

  function reset() {
    setCurrentTrackIndex(null);
    setShuffleMode(false);
    setShuffleOrder([]);
  }

  function handleToggleShuffle() {
    const cur = currentTrackIndex ?? 0;
    if (shuffleMode) {
      const actualIdx = shuffleOrder[cur] ?? 0;
      setShuffleMode(false);
      setShuffleOrder([]);
      setCurrentTrackIndex(actualIdx);
    } else {
      // Fisher-Yates shuffle; keep current track at position 0
      const indices = Array.from({ length: foundTracks.length }, (_, i) => i);
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
    shuffleMode && shuffleOrder.length === foundTracks.length
      ? shuffleOrder.map((i) => foundTracks[i]).filter(Boolean)
      : foundTracks;

  const playingTrackId =
    currentTrackIndex !== null ? (effectiveFoundTracks[currentTrackIndex]?.id ?? null) : null;

  const activeGameId =
    currentTrackIndex !== null
      ? (effectiveFoundTracks[currentTrackIndex]?.game_id ?? null)
      : null;

  return {
    currentTrackIndex,
    setCurrentTrackIndex,
    isPlayerPlaying,
    setIsPlayerPlaying,
    shuffleMode,
    handleToggleShuffle,
    playerBarRef,
    reset,
    effectiveFoundTracks,
    playingTrackId,
    activeGameId,
  };
}
