"use client";

import { forwardRef, useImperativeHandle } from "react";
import Image from "next/image";
import type { PlaylistTrack } from "@/types";
import { useYouTubePlayer } from "@/hooks/useYouTubePlayer";

export interface PlayerBarHandle {
  togglePlayPause: () => void;
}

function fmtTime(s: number): string {
  if (!isFinite(s) || s < 0) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

interface PlayerBarProps {
  tracks: PlaylistTrack[];
  currentIndex: number;
  onIndexChange: (i: number) => void;
  onClose: () => void;
  onPlayingChange?: (playing: boolean) => void;
  shuffleMode?: boolean;
  onToggleShuffle?: () => void;
}

export const PlayerBar = forwardRef<PlayerBarHandle, PlayerBarProps>(function PlayerBar({
  tracks,
  currentIndex,
  onIndexChange,
  onClose,
  onPlayingChange,
  shuffleMode = false,
  onToggleShuffle,
}, ref) {
  const yt = useYouTubePlayer({ tracks, currentIndex, onIndexChange, onPlayingChange });

  useImperativeHandle(ref, () => ({ togglePlayPause: yt.togglePlayPause }));

  const currentTrack = tracks[currentIndex] ?? null;
  const nextTrack = tracks[currentIndex + 1] ?? null;
  const canPrev = currentIndex > 0;
  const canNext = currentIndex < tracks.length - 1;

  if (!currentTrack) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-violet-500/20 bg-zinc-950/97 backdrop-blur-xl shadow-[0_-4px_24px_rgba(0,0,0,0.6)]">
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-violet-500/30 to-transparent" />

      {/* Hidden YT player div */}
      <div
        ref={yt.playerDivRef}
        style={{ position: "fixed", left: -9999, top: 0, width: 1, height: 1 }}
        aria-hidden="true"
      />

      <div className="max-w-6xl mx-auto px-4 py-2.5 flex items-center gap-3">

        {/* Track info */}
        <div className="flex items-center gap-3 w-[220px] min-w-0 shrink-0">
          {currentTrack.thumbnail ? (
            <div className="relative w-14 h-10 shrink-0 rounded-md overflow-hidden bg-zinc-800 ring-1 ring-white/10">
              <Image src={currentTrack.thumbnail} alt="" fill className="object-cover" sizes="56px" />
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

        {/* Center: controls + time */}
        <div className="flex-1 flex flex-col items-center gap-1 min-w-0">
          <div className="flex items-center gap-0.5">
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
              onClick={yt.togglePlayPause}
              aria-label={yt.isPlaying ? "Pause" : "Play"}
              className="p-2.5 rounded-full bg-violet-600 hover:bg-violet-500 text-white shadow-lg shadow-violet-900/40 cursor-pointer"
            >
              {yt.isPlaying ? (
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

          <div className="flex items-center gap-1.5 text-[11px] text-zinc-500 tabular-nums font-mono">
            <span>{fmtTime(yt.currentTime)}</span>
            <span className="text-zinc-700">/</span>
            <span>{fmtTime(yt.duration)}</span>
          </div>
        </div>

        {/* Right: Up Next + controls + links */}
        <div className="flex items-center gap-2 shrink-0">

          {nextTrack && (
            <div className="hidden lg:flex flex-col items-end min-w-0 max-w-[160px]">
              <span className="text-[10px] text-zinc-600 uppercase tracking-wider leading-none mb-0.5">Up Next</span>
              <span className="text-[11px] text-zinc-400 truncate leading-tight max-w-full">
                {nextTrack.video_title ?? nextTrack.track_name ?? ""}
              </span>
            </div>
          )}

          {onToggleShuffle && (
            <button
              onClick={onToggleShuffle}
              title={shuffleMode ? "Shuffle on — click to turn off" : "Shuffle off — click to turn on"}
              className={`p-1.5 rounded-md cursor-pointer transition-colors ${
                shuffleMode ? "text-violet-400 bg-violet-500/15" : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/80"
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M10.59 9.17L5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41l-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z" />
              </svg>
            </button>
          )}

          <button
            onClick={yt.toggleDim}
            title={yt.dimmed ? "Restore volume" : "Dim to 20%"}
            className={`p-1.5 rounded-md cursor-pointer transition-colors ${
              yt.dimmed ? "text-amber-400 bg-amber-500/15" : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/80"
            }`}
          >
            {yt.dimmed ? (
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
              </svg>
            ) : (
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z" />
              </svg>
            )}
          </button>

          <input
            type="range"
            min={0}
            max={100}
            value={yt.volume}
            onChange={(e) => yt.applyVolume(Number(e.target.value))}
            title={`Volume: ${yt.volume}%`}
            className="hidden sm:block w-20 h-1 cursor-pointer accent-violet-500"
          />

          <span className="text-xs text-zinc-400 tabular-nums hidden sm:block">
            {currentIndex + 1} / {tracks.length}
          </span>

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
