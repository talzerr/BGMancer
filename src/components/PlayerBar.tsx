"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import Image from "next/image";
import type { PlaylistTrack } from "@/types";

export interface PlayerBarHandle {
  togglePlayPause: () => void;
}

// ─── Minimal YT IFrame API types ─────────────────────────────────────────────

interface YTPlayer {
  loadVideoById(videoId: string): void;
  playVideo(): void;
  pauseVideo(): void;
  getPlayerState(): number;
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
        }
      ) => YTPlayer;
      PlayerState: { ENDED: number; PLAYING: number; PAUSED: number };
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

interface PlayerBarProps {
  tracks: PlaylistTrack[];     // only 'found' tracks
  currentIndex: number;
  onIndexChange: (i: number) => void;
  onClose: () => void;
  onPlayingChange?: (playing: boolean) => void;
}

export const PlayerBar = forwardRef<PlayerBarHandle, PlayerBarProps>(function PlayerBar({
  tracks,
  currentIndex,
  onIndexChange,
  onClose,
  onPlayingChange,
}, ref) {
  const playerDivRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const [apiReady, setApiReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const isPlayingRef = useRef(false);

  function setPlaying(value: boolean) {
    setIsPlaying(value);
    isPlayingRef.current = value;
    onPlayingChange?.(value);
  }

  useImperativeHandle(ref, () => ({
    togglePlayPause: () => {
      if (!playerRef.current) return;
      if (isPlayingRef.current) {
        playerRef.current.pauseVideo();
        setPlaying(false);
      } else {
        playerRef.current.playVideo();
        setPlaying(true);
      }
    },
  }));

  // Use refs so the YT event callbacks never capture stale values
  const currentIndexRef = useRef(currentIndex);
  const tracksRef = useRef(tracks);
  const onIndexChangeRef = useRef(onIndexChange);

  useEffect(() => { currentIndexRef.current = currentIndex; }, [currentIndex]);
  useEffect(() => { tracksRef.current = tracks; }, [tracks]);
  useEffect(() => { onIndexChangeRef.current = onIndexChange; }, [onIndexChange]);

  const currentTrack = tracks[currentIndex] ?? null;

  // ── Load the YT IFrame API script once ────────────────────────────────────
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

  // ── Create the player once the API is ready ────────────────────────────────
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
          playerRef.current?.playVideo();
          setPlaying(true);
        },
        onStateChange: (e) => {
          setPlaying(e.data === 1); // 1 = playing
          if (e.data === 0) {         // 0 = ended → advance
            const next = currentIndexRef.current + 1;
            if (next < tracksRef.current.length) {
              onIndexChangeRef.current(next);
            } else {
              onIndexChangeRef.current(0); // loop back
            }
          }
        },
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiReady]);

  // ── Load a new video when the track changes ────────────────────────────────
  useEffect(() => {
    const videoId = currentTrack?.video_id;
    if (!videoId || !playerRef.current) return;
    playerRef.current.loadVideoById(videoId);
    setPlaying(true);
  }, [currentTrack?.video_id]);

  // ── Cleanup ────────────────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      playerRef.current?.destroy();
      playerRef.current = null;
    };
  }, []);

  if (!currentTrack) return null;

  const canPrev = currentIndex > 0;
  const canNext = currentIndex < tracks.length - 1;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-violet-500/20 bg-zinc-950/97 backdrop-blur-xl shadow-[0_-4px_24px_rgba(0,0,0,0.6)]">
      {/* Subtle top glow line */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-violet-500/30 to-transparent" />

      {/* Hidden YT player div — must stay in DOM for the API to work */}
      <div
        ref={playerDivRef}
        style={{ position: "fixed", left: -9999, top: 0, width: 1, height: 1 }}
        aria-hidden="true"
      />

      <div className="max-w-6xl mx-auto px-4 py-2.5 flex items-center gap-4">

        {/* ── Track info ─────────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {currentTrack.thumbnail ? (
            <div className="relative w-14 h-10 shrink-0 rounded-md overflow-hidden bg-zinc-800 ring-1 ring-white/10">
              <Image
                src={currentTrack.thumbnail}
                alt=""
                fill
                className="object-cover"
                sizes="56px"
              />
              {/* YouTube attribution — required by YouTube API ToS when showing thumbnails outside native player */}
              <div className="absolute bottom-0 right-0 flex items-center gap-0.5 bg-black/75 px-1 py-0.5 rounded-tl">
                <svg className="w-2 h-2 text-[#FF0000] fill-current shrink-0" viewBox="0 0 24 24">
                  <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                </svg>
                <span className="text-[8px] font-medium text-white leading-none tracking-tight">YouTube</span>
              </div>
            </div>
          ) : (
            <div className="w-14 h-10 shrink-0 rounded-md bg-zinc-800 ring-1 ring-white/10 flex items-center justify-center">
              <svg className="w-5 h-5 text-zinc-500" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
              </svg>
            </div>
          )}
          <div className="min-w-0">
            <p className="text-sm font-medium text-white truncate leading-tight">
              {currentTrack.video_title ?? currentTrack.track_name ?? "Unknown track"}
            </p>
            <p className="text-xs text-zinc-500 truncate mt-0.5">{currentTrack.game_title}</p>
          </div>
        </div>

        {/* ── Playback controls ──────────────────────────────────────────── */}
        <div className="flex items-center gap-0.5 shrink-0">
          <button
            onClick={() => canPrev && onIndexChange(currentIndex - 1)}
            disabled={!canPrev}
            aria-label="Previous track"
            className="p-2 rounded-full text-zinc-500 hover:text-white disabled:opacity-20 cursor-pointer disabled:cursor-default"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 6h2v12H6zm3.5 6 8.5 6V6z" />
            </svg>
          </button>

          <button
            onClick={() => {
              if (isPlaying) {
                playerRef.current?.pauseVideo();
                setPlaying(false);
              } else {
                playerRef.current?.playVideo();
                setPlaying(true);
              }
            }}
            aria-label={isPlaying ? "Pause" : "Play"}
            className="p-2.5 rounded-full bg-violet-600 hover:bg-violet-500 text-white shadow-lg shadow-violet-900/40 cursor-pointer"
          >
            {isPlaying ? (
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>

          <button
            onClick={() => canNext && onIndexChange(currentIndex + 1)}
            disabled={!canNext}
            aria-label="Next track"
            className="p-2 rounded-full text-zinc-500 hover:text-white disabled:opacity-20 cursor-pointer disabled:cursor-default"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
            </svg>
          </button>
        </div>

        {/* ── Track counter + links ──────────────────────────────────────── */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-zinc-400 tabular-nums">
            {currentIndex + 1} / {tracks.length}
          </span>

          {/* YouTube attribution link — required by YouTube API ToS */}
          <a
            href={`https://www.youtube.com/watch?v=${currentTrack.video_id}`}
            target="_blank"
            rel="noopener noreferrer"
            title="Watch on YouTube"
            className="flex items-center gap-1 rounded-md bg-zinc-800/80 hover:bg-zinc-700/80 border border-white/[0.06] px-2 py-1 text-xs font-medium text-zinc-400 hover:text-white"
          >
            <svg className="w-3 h-3 text-[#FF0000] fill-current" viewBox="0 0 24 24">
              <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
            </svg>
            <span className="hidden sm:inline">YouTube</span>
          </a>

          <button
            onClick={onClose}
            title="Close player"
            className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/80 cursor-pointer"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
});
