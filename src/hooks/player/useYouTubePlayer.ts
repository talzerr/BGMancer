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

// ─── Module-level singleton ──────────────────────────────────────────────────
// Only one YouTube player instance can exist at a time. Storing the reference
// at module scope (rather than in a useRef) guarantees that even if the hook
// unmounts and remounts, the previous player is destroyed before a new one is
// created. This prevents the "two tracks playing simultaneously" bug.

let singletonPlayer: YTPlayer | null = null;

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
  /** When true, the player loads the video but does not auto-play (used for restore) */
  startPaused?: boolean;
  /** Seek to this position (seconds) when the player first loads (used for restore) */
  initialSeekSeconds?: number;
  /** Called periodically (~5s) with the current playback position while playing */
  onTimeUpdate?: (time: number) => void;
}

export function useYouTubePlayer({
  tracks,
  currentIndex,
  onIndexChange,
  onPlayingChange,
  startPaused,
  initialSeekSeconds,
  onTimeUpdate,
}: UseYouTubePlayerOptions) {
  const playerDivRef = useRef<HTMLDivElement>(null);
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

  // Restore refs — consumed once on first player load, then cleared
  const startPausedRef = useRef(!!startPaused);
  const initialSeekSecondsRef = useRef(initialSeekSeconds ?? 0);
  const onTimeUpdateRef = useRef(onTimeUpdate);
  const tickCountRef = useRef(0);

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

  // Poll elapsed time while playing; call onTimeUpdate every ~5s (20 ticks × 250ms)
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
        if (tickCountRef.current >= 20) {
          tickCountRef.current = 0;
          if (isFinite(ct)) onTimeUpdateRef.current?.(ct);
        }
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
    if (!apiReady || !playerDivRef.current) return;
    const videoId = tracksRef.current[currentIndexRef.current]?.video_id;
    if (!videoId) return;

    // Destroy any existing player before creating a new one (singleton guarantee)
    destroySingleton();

    const paused = startPausedRef.current;
    singletonPlayer = new window.YT.Player(playerDivRef.current, {
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
    // currentIndexRef and tracksRef are intentionally omitted: the player is
    // created once on API ready with whatever track is current at that moment.
    // Adding them would tear down and recreate the player on every track change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiReady]);

  // Load a new video when the track changes
  const currentVideoId = tracks[currentIndex]?.video_id;
  useEffect(() => {
    if (!currentVideoId || !singletonPlayer) return;
    // On restore, the video was already loaded by the creation effect — skip
    // the redundant loadVideoById and its auto-play side effect.
    if (startPausedRef.current) {
      startPausedRef.current = false;
      return;
    }
    singletonPlayer.loadVideoById(currentVideoId);
    singletonPlayer.setVolume(volumeRef.current);
    setCurrentTime(0);
    setDuration(0);
    setPlaying(true);
    // setPlaying is intentionally omitted: it's a plain function that captures
    // onPlayingChange from props. Wrapping it in useCallback would couple this
    // effect's stability to the onPlayingChange prop reference chain.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentVideoId]);

  // Cleanup
  useEffect(() => {
    return () => destroySingleton();
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
