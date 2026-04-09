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

// Module-level singleton — only one YT player can exist at a time.
let singletonPlayer: YTPlayer | null = null;

const POLL_INTERVAL_MS = 250;
// Emit an onTimeUpdate callback every Nth poll tick. At 250ms × 20 = ~5s,
// which is the cadence we use to persist the playback position.
const TIME_UPDATE_TICK_INTERVAL = 20;

function destroySingleton() {
  if (singletonPlayer) {
    singletonPlayer.destroy();
    singletonPlayer = null;
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

interface UseYouTubePlayerOptions {
  tracks: PlaylistTrack[];
  currentIndex: number;
  onIndexChange: (i: number) => void;
  onPlayingChange?: (playing: boolean) => void;
  startPaused?: boolean;
  initialSeekSeconds?: number;
  onTimeUpdate?: (time: number) => void;
  /** When false, the hook skips all effects and returns inert state. */
  enabled?: boolean;
}

export function useYouTubePlayer({
  tracks,
  currentIndex,
  onIndexChange,
  onPlayingChange,
  startPaused,
  initialSeekSeconds,
  onTimeUpdate,
  enabled = true,
}: UseYouTubePlayerOptions) {
  const playerElRef = useRef<HTMLDivElement | null>(null);
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

  const startPausedRef = useRef(!!startPaused);
  const initialSeekSecondsRef = useRef(initialSeekSeconds ?? 0);
  const onTimeUpdateRef = useRef(onTimeUpdate);
  const tickCountRef = useRef(0);

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
  useEffect(() => {
    onTimeUpdateRef.current = onTimeUpdate;
  }, [onTimeUpdate]);

  function setPlaying(value: boolean) {
    setIsPlayingState(value);
    isPlayingRef.current = value;
    onPlayingChange?.(value);
  }

  function applyVolume(v: number) {
    volumeRef.current = v;
    setVolumeState(v);
    singletonPlayer?.setVolume(v);
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
    if (!singletonPlayer) return;
    if (isPlayingRef.current) {
      singletonPlayer.pauseVideo();
      setPlaying(false);
    } else {
      singletonPlayer.playVideo();
      setPlaying(true);
    }
  }

  function seekTo(seconds: number) {
    singletonPlayer?.seekTo(seconds, true);
    setCurrentTime(seconds);
  }

  useEffect(() => {
    if (!isPlaying) return;
    tickCountRef.current = 0;
    const id = setInterval(() => {
      if (singletonPlayer) {
        const ct = singletonPlayer.getCurrentTime();
        const dur = singletonPlayer.getDuration();
        if (isFinite(ct)) setCurrentTime(ct);
        if (isFinite(dur) && dur > 0) setDuration(dur);
        tickCountRef.current += 1;
        if (tickCountRef.current >= TIME_UPDATE_TICK_INTERVAL) {
          tickCountRef.current = 0;
          if (isFinite(ct)) onTimeUpdateRef.current?.(ct);
        }
      }
    }, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [isPlaying]);

  // Create a DOM element outside React's tree for the YouTube iframe.
  // This prevents DOM reconciliation errors during App Router page transitions.
  useEffect(() => {
    if (playerElRef.current) return;
    const el = document.createElement("div");
    el.style.cssText = "position:fixed;left:-9999px;top:0;width:1px;height:1px";
    el.setAttribute("aria-hidden", "true");
    document.body.appendChild(el);
    playerElRef.current = el;
    return () => {
      el.remove();
      playerElRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!enabled) return;
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
  }, [enabled]);

  useEffect(() => {
    if (!enabled || !apiReady || !playerElRef.current) return;
    const videoId = tracksRef.current[currentIndexRef.current]?.video_id;
    if (!videoId) return;

    destroySingleton();

    const paused = startPausedRef.current;
    startPausedRef.current = false;
    singletonPlayer = new window.YT.Player(playerElRef.current, {
      videoId,
      width: 1,
      height: 1,
      playerVars: { autoplay: paused ? 0 : 1, controls: 0 },
      events: {
        onReady: () => {
          singletonPlayer?.setVolume(volumeRef.current);
          if (initialSeekSecondsRef.current > 0) {
            singletonPlayer?.seekTo(initialSeekSecondsRef.current, true);
            setCurrentTime(initialSeekSecondsRef.current);
            initialSeekSecondsRef.current = 0;
          }
          if (!paused) {
            singletonPlayer?.playVideo();
            setPlaying(true);
          }
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiReady]);

  const currentVideoId = tracks[currentIndex]?.video_id;
  useEffect(() => {
    if (!enabled || !currentVideoId || !singletonPlayer) return;
    singletonPlayer.loadVideoById(currentVideoId);
    singletonPlayer.setVolume(volumeRef.current);
    setCurrentTime(0);
    setDuration(0);
    setPlaying(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentVideoId]);

  useEffect(() => {
    return () => destroySingleton();
  }, []);

  return {
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
