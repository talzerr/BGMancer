"use client";

import { forwardRef, useImperativeHandle, useState } from "react";
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
  ChevronDownIcon,
  ChevronUpIcon,
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
  onPlayingChange?: (playing: boolean) => void;
  shuffleMode?: boolean;
  onToggleShuffle?: () => void;
  gameThumbnailByGameId?: Map<string, string>;
}

export const PlayerBar = forwardRef<PlayerBarHandle, PlayerBarProps>(function PlayerBar(
  {
    tracks,
    currentIndex,
    onIndexChange,
    onPlayingChange,
    shuffleMode = false,
    onToggleShuffle,
    gameThumbnailByGameId,
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
    seekTo,
    applyVolume,
    toggleDim,
  } = useYouTubePlayer({ tracks, currentIndex, onIndexChange, onPlayingChange });

  const [isSeeking, setIsSeeking] = useState(false);
  const [seekingValue, setSeekingValue] = useState(0);
  const [isMinimized, setIsMinimized] = useState(false);

  const safeDuration = isFinite(duration) && duration > 0 ? duration : 0;
  const displayTime = isFinite(isSeeking ? seekingValue : currentTime)
    ? isSeeking
      ? seekingValue
      : currentTime
    : 0;
  const fillPct = safeDuration > 0 ? (displayTime / safeDuration) * 100 : 0;

  useImperativeHandle(ref, () => ({ togglePlayPause }));

  const currentTrack = tracks[currentIndex] ?? null;
  const nextTrack = tracks[currentIndex + 1] ?? null;
  const canPrev = currentIndex > 0;
  const canNext = currentIndex < tracks.length - 1;

  const steamThumbnail = currentTrack
    ? (gameThumbnailByGameId?.get(currentTrack.game_id) ?? null)
    : null;
  const thumbnailSrc = steamThumbnail ?? currentTrack?.thumbnail ?? null;
  const thumbnailIsYouTube = !steamThumbnail && !!currentTrack?.thumbnail;

  if (!currentTrack) return null;

  return (
    <div className="border-border bg-background/97 fixed right-0 bottom-0 left-0 z-50 border-t backdrop-blur-xl">
      {/* Seek bar — full width, positioned at the very top of the player */}
      <input
        type="range"
        min={0}
        max={Math.max(safeDuration, 1)}
        step={1}
        value={displayTime}
        onPointerDown={() => {
          setIsSeeking(true);
          setSeekingValue(currentTime);
        }}
        onChange={(e) => setSeekingValue(Number(e.target.value))}
        onPointerUp={(e) => {
          seekTo(Number((e.target as HTMLInputElement).value));
          setIsSeeking(false);
        }}
        aria-label="Seek"
        style={{
          background: `linear-gradient(to right, #D4A04A 0%, #D4A04A ${fillPct}%, #1c1b17 ${fillPct}%, #1c1b17 100%)`,
        }}
        className="[&::-webkit-slider-thumb]:bg-primary absolute top-0 right-0 left-0 h-1 w-full cursor-pointer appearance-none accent-[#D4A04A] [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:opacity-0 hover:[&::-webkit-slider-thumb]:opacity-100"
      />

      {/* Hidden YT player div */}
      <div
        ref={playerDivRef}
        style={{ position: "fixed", left: -9999, top: 0, width: 1, height: 1 }}
        aria-hidden="true"
      />

      {isMinimized ? (
        <button
          onClick={() => setIsMinimized(false)}
          title="Expand player"
          className="hover:text-muted-foreground flex w-full items-center justify-center py-1 text-[var(--text-disabled)] transition-colors"
        >
          <ChevronUpIcon className="h-3 w-3" />
        </button>
      ) : (
        <div className="mx-auto grid max-w-6xl grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 py-2.5">
          {/* Track info */}
          <div className="flex min-w-0 items-center gap-3">
            {/* Track counter */}
            <span className="shrink-0 font-mono text-[10px] text-[var(--text-disabled)] tabular-nums">
              <span className="text-muted-foreground">{currentIndex + 1}</span>
              <span className="mx-0.5">/</span>
              <span>{tracks.length}</span>
            </span>

            {thumbnailSrc ? (
              <div className="bg-secondary relative h-10 w-14 shrink-0 overflow-hidden rounded-md ring-1 ring-white/10">
                <Image
                  src={thumbnailSrc}
                  alt=""
                  fill
                  className="object-cover"
                  sizes="56px"
                  loading="eager"
                />
                {thumbnailIsYouTube && (
                  <div className="absolute right-0 bottom-0 flex items-center gap-0.5 rounded-tl bg-black/75 px-1 py-0.5">
                    <YouTubeLogo className="h-2 w-2 shrink-0 fill-current text-[#FF0000]" />
                    <span className="text-foreground text-[8px] leading-none font-medium tracking-tight">
                      YouTube
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-secondary flex h-10 w-14 shrink-0 items-center justify-center rounded-md ring-1 ring-white/10">
                <MusicNote className="h-5 w-5 text-[var(--text-tertiary)]" />
              </div>
            )}
            <div className="min-w-0">
              <p className="text-foreground truncate text-sm leading-tight font-medium">
                {currentTrack.track_name ?? currentTrack.video_title ?? "Unknown track"}
              </p>
              <p className="mt-0.5 truncate text-xs text-[var(--text-tertiary)]">
                {currentTrack.game_title}
              </p>
            </div>
          </div>

          {/* Center: controls + time */}
          <div className="flex flex-col items-center gap-1">
            <div className="flex items-center gap-0.5">
              <button
                onClick={() => canPrev && onIndexChange(currentIndex - 1)}
                disabled={!canPrev}
                aria-label="Previous track"
                className="hover:text-foreground cursor-pointer rounded-full p-2 text-[var(--text-tertiary)] disabled:cursor-default disabled:opacity-20"
              >
                <PrevTrackIcon />
              </button>

              <button
                onClick={togglePlayPause}
                aria-label={isPlaying ? "Pause" : "Play"}
                className="bg-primary text-primary-foreground cursor-pointer rounded-full p-2.5 hover:bg-[var(--primary-hover)]"
              >
                {isPlaying ? <PauseIcon /> : <PlayIcon />}
              </button>

              <button
                onClick={() => canNext && onIndexChange(currentIndex + 1)}
                disabled={!canNext}
                aria-label="Next track"
                className="hover:text-foreground cursor-pointer rounded-full p-2 text-[var(--text-tertiary)] disabled:cursor-default disabled:opacity-20"
              >
                <NextTrackIcon />
              </button>
            </div>

            <div className="flex items-center gap-1.5 font-mono text-[11px] text-[var(--text-tertiary)] tabular-nums">
              <span>{fmtTime(currentTime)}</span>
              <span className="text-[var(--text-disabled)]">/</span>
              <span>{fmtTime(safeDuration)}</span>
            </div>
          </div>

          {/* Right: Up Next + controls + links */}
          <div className="flex min-w-0 items-center justify-end gap-2">
            {nextTrack && (
              <div className="hidden max-w-[160px] min-w-0 flex-col items-end lg:flex">
                <span className="mb-0.5 text-[10px] leading-none tracking-wider text-[var(--text-disabled)] uppercase">
                  Up Next
                </span>
                {nextTrack.game_title && (
                  <span className="max-w-full truncate text-[10px] leading-tight text-[var(--text-disabled)]">
                    {nextTrack.game_title}
                  </span>
                )}
                <span className="text-muted-foreground max-w-full truncate text-[11px] leading-tight">
                  {nextTrack.track_name ?? nextTrack.video_title ?? ""}
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
                    ? "bg-primary/15 text-primary"
                    : "hover:bg-secondary/80 hover:text-foreground text-[var(--text-tertiary)]"
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
                  ? "bg-primary/15 text-primary"
                  : "hover:bg-secondary/80 hover:text-foreground text-[var(--text-tertiary)]"
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
              className="accent-primary hidden h-1 w-20 cursor-pointer sm:block"
            />

            <a
              href={`https://www.youtube.com/watch?v=${currentTrack.video_id}`}
              target="_blank"
              rel="noopener noreferrer"
              title="Watch on YouTube"
              className="border-border bg-secondary/80 text-muted-foreground hover:text-foreground flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium hover:bg-[var(--surface-hover)]/80"
            >
              <YouTubeLogo className="h-3 w-3 fill-current text-[#FF0000]" />
              <span className="hidden sm:inline">YouTube</span>
            </a>

            <button
              onClick={() => setIsMinimized(true)}
              title="Minimize player"
              className="text-muted-foreground hover:bg-secondary/80 hover:text-foreground cursor-pointer rounded-md p-1.5"
            >
              <ChevronDownIcon />
            </button>
          </div>
        </div>
      )}
    </div>
  );
});
