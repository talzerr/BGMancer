"use client";

import { useEffect, useRef, useState } from "react";
import type { PlaylistTrack } from "@/types";

// ─── Minimal YT IFrame API types ─────────────────────────────────────────────

export interface YTPlayer {
  loadVideoById(videoId: string): void;
  playVideo(): void;
  pauseVideo(): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  getPlayerState(): number;
  getCurrentTime(): number;
  getDuration(): number;
  setVolume(volume: number): void;
  destroy(): void;
}

declare global {
  interface Window {
    YT: {
      Player: new (
        el: HTMLElement,
        opts: {
          videoId: string;
          width: number;
          height: number;
          playerVars?: { autoplay?: 0 | 1; controls?: 0 | 1 };
          events?: {
            onReady?: () => void;
            onStateChange?: (e: { data: number }) => void;
          };
        },
      ) => YTPlayer;
      PlayerState: { ENDED: number; PLAYING: number; PAUSED: number };
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

interface UseYouTubePlayerOptions {
  tracks: PlaylistTrack[];
  currentIndex: number;
  onIndexChange: (i: number) => void;
  onPlayingChange?: (playing: boolean) => void;
}

export function useYouTubePlayer({
  tracks,
  currentIndex,
  onIndexChange,
  onPlayingChange,
}: UseYouTubePlayerOptions) {
  const playerDivRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const [apiReady, setApiReady] = useState(false);
  const [isPlaying, setIsPlayingState] = useState(false);
  const isPlayingRef = useRef(false);

  // Time
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // Volume
  const [volume, setVolumeState] = useState(100);
  const [dimmed, setDimmed] = useState(false);
  const volumeRef = useRef(100);
  const preVolumeRef = useRef(100);

  // Stable refs for YT callbacks
  const currentIndexRef = useRef(currentIndex);
  const tracksRef = useRef(tracks);
  const onIndexChangeRef = useRef(onIndexChange);

  useEffect(() => {
    currentIndexRef.current = currentIndex;
  }, [currentIndex]);
  useEffect(() => {
    tracksRef.current = tracks;
  }, [tracks]);
  useEffect(() => {
    onIndexChangeRef.current = onIndexChange;
  }, [onIndexChange]);

  function setPlaying(value: boolean) {
    setIsPlayingState(value);
    isPlayingRef.current = value;
    onPlayingChange?.(value);
  }

  function applyVolume(v: number) {
    volumeRef.current = v;
    setVolumeState(v);
    playerRef.current?.setVolume(v);
  }

  function toggleDim() {
    if (dimmed) {
      applyVolume(preVolumeRef.current);
      setDimmed(false);
    } else {
      preVolumeRef.current = volumeRef.current;
      applyVolume(20);
      setDimmed(true);
    }
  }

  function togglePlayPause() {
    if (!playerRef.current) return;
    if (isPlayingRef.current) {
      playerRef.current.pauseVideo();
      setPlaying(false);
    } else {
      playerRef.current.playVideo();
      setPlaying(true);
    }
  }

  function seekTo(seconds: number) {
    playerRef.current?.seekTo(seconds, true);
    setCurrentTime(seconds);
  }

  // Poll elapsed time while playing
  useEffect(() => {
    if (!isPlaying) return;
    const id = setInterval(() => {
      if (playerRef.current) {
        const ct = playerRef.current.getCurrentTime();
        const dur = playerRef.current.getDuration();
        if (isFinite(ct)) setCurrentTime(ct);
        if (isFinite(dur) && dur > 0) setDuration(dur);
      }
    }, 250);
    return () => clearInterval(id);
  }, [isPlaying]);

  // Load the YT IFrame API script once
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.YT?.Player) {
      setApiReady(true);
      return;
    }

    if (!document.getElementById("yt-iframe-api")) {
      const tag = document.createElement("script");
      tag.id = "yt-iframe-api";
      tag.src = "https://www.youtube.com/iframe_api";
      document.body.appendChild(tag);
    }
    window.onYouTubeIframeAPIReady = () => setApiReady(true);
  }, []);

  // Create the player once the API is ready
  useEffect(() => {
    if (!apiReady || !playerDivRef.current || playerRef.current) return;
    const videoId = tracksRef.current[currentIndexRef.current]?.video_id;
    if (!videoId) return;

    playerRef.current = new window.YT.Player(playerDivRef.current, {
      videoId,
      width: 1,
      height: 1,
      playerVars: { autoplay: 1, controls: 0 },
      events: {
        onReady: () => {
          playerRef.current?.setVolume(volumeRef.current);
          playerRef.current?.playVideo();
          setPlaying(true);
        },
        onStateChange: (e) => {
          setPlaying(e.data === 1);
          if (e.data === 0) {
            const next = currentIndexRef.current + 1;
            onIndexChangeRef.current(next < tracksRef.current.length ? next : 0);
          }
        },
      },
    });
    // currentIndexRef and tracksRef are intentionally omitted: the player is
    // created once on API ready with whatever track is current at that moment.
    // Adding them would tear down and recreate the player on every track change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiReady]);

  // Load a new video when the track changes
  const currentVideoId = tracks[currentIndex]?.video_id;
  useEffect(() => {
    if (!currentVideoId || !playerRef.current) return;
    playerRef.current.loadVideoById(currentVideoId);
    playerRef.current.setVolume(volumeRef.current);
    setCurrentTime(0);
    setDuration(0);
    setPlaying(true);
    // setPlaying is intentionally omitted: it's a stable internal helper derived
    // from setState calls; including it would cause the effect to re-run spuriously.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentVideoId]);

  // Cleanup
  useEffect(() => {
    return () => {
      playerRef.current?.destroy();
      playerRef.current = null;
    };
  }, []);

  return {
    playerDivRef,
    isPlaying,
    currentTime,
    duration,
    volume,
    dimmed,
    togglePlayPause,
    seekTo,
    applyVolume,
    toggleDim,
  };
}
