"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import type { PlaylistTrack } from "@/types";

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
}

export function PlayerBar({
  tracks,
  currentIndex,
  onIndexChange,
  onClose,
}: PlayerBarProps) {
  const playerDivRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const [apiReady, setApiReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

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
          setIsPlaying(true);
        },
        onStateChange: (e) => {
          setIsPlaying(e.data === 1); // 1 = playing
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
    setIsPlaying(true);
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
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-zinc-900/95 backdrop-blur border-t border-zinc-700/60">
      {/* Hidden YT player div — must stay in DOM for the API to work */}
      <div
        ref={playerDivRef}
        style={{ position: "fixed", left: -9999, top: 0, width: 1, height: 1 }}
        aria-hidden="true"
      />

      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-4">

        {/* ── Track info ─────────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {currentTrack.thumbnail && (
            <div className="relative w-12 h-9 shrink-0 rounded overflow-hidden bg-zinc-800">
              <Image
                src={currentTrack.thumbnail}
                alt=""
                fill
                className="object-cover"
                sizes="48px"
              />
            </div>
          )}
          <div className="min-w-0">
            <p className="text-sm font-medium text-white truncate leading-tight">
              {currentTrack.video_title ?? currentTrack.track_name ?? "Unknown track"}
            </p>
            <p className="text-xs text-zinc-400 truncate mt-0.5">{currentTrack.game_title}</p>
          </div>
        </div>

        {/* ── Playback controls ──────────────────────────────────────────── */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => canPrev && onIndexChange(currentIndex - 1)}
            disabled={!canPrev}
            aria-label="Previous track"
            className="p-2 rounded-full text-zinc-400 hover:text-white disabled:opacity-25 transition cursor-pointer disabled:cursor-default"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 6h2v12H6zm3.5 6 8.5 6V6z" />
            </svg>
          </button>

          <button
            onClick={() => {
              if (isPlaying) {
                playerRef.current?.pauseVideo();
                setIsPlaying(false);
              } else {
                playerRef.current?.playVideo();
                setIsPlaying(true);
              }
            }}
            aria-label={isPlaying ? "Pause" : "Play"}
            className="p-2.5 rounded-full bg-white text-zinc-900 hover:bg-zinc-200 transition cursor-pointer"
          >
            {isPlaying ? (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>

          <button
            onClick={() => canNext && onIndexChange(currentIndex + 1)}
            disabled={!canNext}
            aria-label="Next track"
            className="p-2 rounded-full text-zinc-400 hover:text-white disabled:opacity-25 transition cursor-pointer disabled:cursor-default"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
            </svg>
          </button>
        </div>

        {/* ── Track counter + links ──────────────────────────────────────── */}
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-xs text-zinc-500 tabular-nums">
            {currentIndex + 1} / {tracks.length}
          </span>

          <a
            href={`https://www.youtube.com/watch?v=${currentTrack.video_id}`}
            target="_blank"
            rel="noopener noreferrer"
            title="Open in YouTube"
            className="p-1.5 rounded text-zinc-500 hover:text-red-400 transition"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
            </svg>
          </a>

          <button
            onClick={onClose}
            title="Close player"
            className="p-1.5 rounded text-zinc-500 hover:text-zinc-200 transition cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
