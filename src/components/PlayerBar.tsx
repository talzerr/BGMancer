"use client";

import { forwardRef, useImperativeHandle } from "react";
import Image from "next/image";
import type { PlaylistTrack } from "@/types";
import { useYouTubePlayer } from "@/hooks/useYouTubePlayer";
import {
  YouTubeLogo,
  MusicNote,
  PlayIcon,
  PauseIcon,
  PrevTrackIcon,
  NextTrackIcon,
  ShuffleIcon,
  VolumeLow,
  VolumeMuted,
  CloseIcon,
} from "@/components/Icons";

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

export const PlayerBar = forwardRef<PlayerBarHandle, PlayerBarProps>(function PlayerBar(
  {
    tracks,
    currentIndex,
    onIndexChange,
    onClose,
    onPlayingChange,
    shuffleMode = false,
    onToggleShuffle,
  },
  ref,
) {
  const {
    playerDivRef,
    isPlaying,
    currentTime,
    duration,
    volume,
    dimmed,
    togglePlayPause,
    applyVolume,
    toggleDim,
  } = useYouTubePlayer({ tracks, currentIndex, onIndexChange, onPlayingChange });

  useImperativeHandle(ref, () => ({ togglePlayPause }));

  const currentTrack = tracks[currentIndex] ?? null;
  const nextTrack = tracks[currentIndex + 1] ?? null;
  const canPrev = currentIndex > 0;
  const canNext = currentIndex < tracks.length - 1;

  if (!currentTrack) return null;

  return (
    <div className="fixed right-0 bottom-0 left-0 z-50 border-t border-violet-500/20 bg-zinc-950/97 shadow-[0_-4px_24px_rgba(0,0,0,0.6)] backdrop-blur-xl">
      <div className="absolute top-0 right-0 left-0 h-px bg-gradient-to-r from-transparent via-violet-500/30 to-transparent" />

      {/* Hidden YT player div */}
      <div
        ref={playerDivRef}
        style={{ position: "fixed", left: -9999, top: 0, width: 1, height: 1 }}
        aria-hidden="true"
      />

      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2.5">
        {/* Track info */}
        <div className="flex w-[220px] min-w-0 shrink-0 items-center gap-3">
          {currentTrack.thumbnail ? (
            <div className="relative h-10 w-14 shrink-0 overflow-hidden rounded-md bg-zinc-800 ring-1 ring-white/10">
              <Image
                src={currentTrack.thumbnail}
                alt=""
                fill
                className="object-cover"
                sizes="56px"
              />
              <div className="absolute right-0 bottom-0 flex items-center gap-0.5 rounded-tl bg-black/75 px-1 py-0.5">
                <YouTubeLogo className="h-2 w-2 shrink-0 fill-current text-[#FF0000]" />
                <span className="text-[8px] leading-none font-medium tracking-tight text-white">
                  YouTube
                </span>
              </div>
            </div>
          ) : (
            <div className="flex h-10 w-14 shrink-0 items-center justify-center rounded-md bg-zinc-800 ring-1 ring-white/10">
              <MusicNote className="h-5 w-5 text-zinc-500" />
            </div>
          )}
          <div className="min-w-0">
            <p className="truncate text-sm leading-tight font-medium text-white">
              {currentTrack.video_title ?? currentTrack.track_name ?? "Unknown track"}
            </p>
            <p className="mt-0.5 truncate text-xs text-zinc-500">{currentTrack.game_title}</p>
          </div>
        </div>

        {/* Center: controls + time */}
        <div className="flex min-w-0 flex-1 flex-col items-center gap-1">
          <div className="flex items-center gap-0.5">
            <button
              onClick={() => canPrev && onIndexChange(currentIndex - 1)}
              disabled={!canPrev}
              aria-label="Previous track"
              className="cursor-pointer rounded-full p-2 text-zinc-500 hover:text-white disabled:cursor-default disabled:opacity-20"
            >
              <PrevTrackIcon />
            </button>

            <button
              onClick={togglePlayPause}
              aria-label={isPlaying ? "Pause" : "Play"}
              className="cursor-pointer rounded-full bg-violet-600 p-2.5 text-white shadow-lg shadow-violet-900/40 hover:bg-violet-500"
            >
              {isPlaying ? <PauseIcon /> : <PlayIcon />}
            </button>

            <button
              onClick={() => canNext && onIndexChange(currentIndex + 1)}
              disabled={!canNext}
              aria-label="Next track"
              className="cursor-pointer rounded-full p-2 text-zinc-500 hover:text-white disabled:cursor-default disabled:opacity-20"
            >
              <NextTrackIcon />
            </button>
          </div>

          <div className="flex items-center gap-1.5 font-mono text-[11px] text-zinc-500 tabular-nums">
            <span>{fmtTime(currentTime)}</span>
            <span className="text-zinc-700">/</span>
            <span>{fmtTime(duration)}</span>
          </div>
        </div>

        {/* Right: Up Next + controls + links */}
        <div className="flex shrink-0 items-center gap-2">
          {nextTrack && (
            <div className="hidden max-w-[160px] min-w-0 flex-col items-end lg:flex">
              <span className="mb-0.5 text-[10px] leading-none tracking-wider text-zinc-600 uppercase">
                Up Next
              </span>
              <span className="max-w-full truncate text-[11px] leading-tight text-zinc-400">
                {nextTrack.video_title ?? nextTrack.track_name ?? ""}
              </span>
            </div>
          )}

          {onToggleShuffle && (
            <button
              onClick={onToggleShuffle}
              title={
                shuffleMode ? "Shuffle on — click to turn off" : "Shuffle off — click to turn on"
              }
              className={`cursor-pointer rounded-md p-1.5 transition-colors ${
                shuffleMode
                  ? "bg-violet-500/15 text-violet-400"
                  : "text-zinc-500 hover:bg-zinc-800/80 hover:text-zinc-300"
              }`}
            >
              <ShuffleIcon />
            </button>
          )}

          <button
            onClick={toggleDim}
            title={dimmed ? "Restore volume" : "Dim to 20%"}
            className={`cursor-pointer rounded-md p-1.5 transition-colors ${
              dimmed
                ? "bg-amber-500/15 text-amber-400"
                : "text-zinc-500 hover:bg-zinc-800/80 hover:text-zinc-300"
            }`}
          >
            {dimmed ? <VolumeMuted /> : <VolumeLow />}
          </button>

          <input
            type="range"
            min={0}
            max={100}
            value={volume}
            onChange={(e) => applyVolume(Number(e.target.value))}
            title={`Volume: ${volume}%`}
            className="hidden h-1 w-20 cursor-pointer accent-violet-500 sm:block"
          />

          <span className="hidden text-xs text-zinc-400 tabular-nums sm:block">
            {currentIndex + 1} / {tracks.length}
          </span>

          <a
            href={`https://www.youtube.com/watch?v=${currentTrack.video_id}`}
            target="_blank"
            rel="noopener noreferrer"
            title="Watch on YouTube"
            className="flex items-center gap-1 rounded-md border border-white/[0.06] bg-zinc-800/80 px-2 py-1 text-xs font-medium text-zinc-400 hover:bg-zinc-700/80 hover:text-white"
          >
            <YouTubeLogo className="h-3 w-3 fill-current text-[#FF0000]" />
            <span className="hidden sm:inline">YouTube</span>
          </a>

          <button
            onClick={onClose}
            title="Close player"
            className="cursor-pointer rounded-md p-1.5 text-zinc-400 hover:bg-zinc-800/80 hover:text-zinc-200"
          >
            <CloseIcon />
          </button>
        </div>
      </div>
    </div>
  );
});
