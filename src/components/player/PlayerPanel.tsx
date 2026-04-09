"use client";

import Image from "next/image";
import { useCallback, useRef } from "react";
import { usePlayerContext } from "@/context/player-context";
import {
  YouTubeLogo,
  MusicNote,
  PlayIcon,
  PauseIcon,
  PrevTrackIcon,
  NextTrackIcon,
  VolumeHigh,
} from "@/components/Icons";

function fmtTime(s: number): string {
  if (!isFinite(s) || s < 0) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

export function PlayerPanel() {
  const { player, media, gameThumbnailByGameId } = usePlayerContext();

  if (!media) {
    return <aside className="w-20 shrink-0 border-l border-[rgba(255,255,255,0.04)]" />;
  }

  const tracks = player.effectiveFoundTracks;
  const currentIndex = player.currentTrackIndex!;
  const { isPlaying, currentTime, duration, volume, togglePlayPause, applyVolume } = media;

  const currentTrack = tracks[currentIndex] ?? null;
  const canPrev = currentIndex > 0;
  const canNext = currentIndex < tracks.length - 1;

  const safeDuration = isFinite(duration) && duration > 0 ? duration : 0;
  const fillPct = safeDuration > 0 ? (currentTime / safeDuration) * 100 : 0;

  const steamThumbnail = currentTrack
    ? (gameThumbnailByGameId?.get(currentTrack.game_id) ?? null)
    : null;
  const thumbnailSrc = steamThumbnail ?? currentTrack?.thumbnail ?? null;

  if (!currentTrack) return null;

  return (
    <aside className="flex h-screen w-20 shrink-0 flex-col items-center border-l border-[rgba(255,255,255,0.04)] px-3 py-3">
      {/* Cover art */}
      {thumbnailSrc ? (
        <div className="bg-secondary relative h-[44px] w-16 shrink-0 overflow-hidden rounded ring-1 ring-white/[0.06]">
          <Image src={thumbnailSrc} alt="" fill className="object-cover" sizes="64px" />
        </div>
      ) : (
        <div className="bg-secondary flex h-[44px] w-16 shrink-0 items-center justify-center rounded ring-1 ring-white/[0.06]">
          <MusicNote className="h-4 w-4 text-[var(--text-tertiary)]" />
        </div>
      )}

      {/* Track info */}
      <div className="mt-1.5 w-16 min-w-0 text-center">
        <p className="truncate text-[9px] leading-tight text-[var(--text-secondary)]">
          {currentTrack.track_name ?? currentTrack.video_title ?? ""}
        </p>
        <p className="truncate text-[8px] leading-tight text-[var(--text-disabled)]">
          {currentTrack.game_title}
        </p>
      </div>

      {/* Progress bar */}
      <div className="mt-3 w-full">
        <div className="h-[2px] w-full overflow-hidden rounded-full bg-[rgba(255,255,255,0.08)]">
          <div className="bg-primary h-full rounded-full" style={{ width: `${fillPct}%` }} />
        </div>
        <div className="mt-0.5 flex justify-between font-mono text-[8px] text-[var(--text-disabled)] tabular-nums">
          <span>{fmtTime(currentTime)}</span>
          <span>{fmtTime(safeDuration)}</span>
        </div>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Transport: prev above, play/pause center, next below */}
      <div className="flex flex-col items-center gap-3">
        <button
          onClick={() => canPrev && player.setCurrentTrackIndex(currentIndex - 1)}
          disabled={!canPrev}
          aria-label="Previous track"
          className="cursor-pointer text-[var(--text-tertiary)] disabled:opacity-20"
        >
          <PrevTrackIcon className="h-4 w-4" />
        </button>

        <button
          onClick={togglePlayPause}
          aria-label={isPlaying ? "Pause" : "Play"}
          className="bg-primary text-primary-foreground flex h-[30px] w-[30px] cursor-pointer items-center justify-center rounded-full hover:bg-[var(--primary-hover)]"
        >
          {isPlaying ? <PauseIcon className="h-3 w-3" /> : <PlayIcon className="h-3 w-3" />}
        </button>

        <button
          onClick={() => canNext && player.setCurrentTrackIndex(currentIndex + 1)}
          disabled={!canNext}
          aria-label="Next track"
          className="cursor-pointer text-[var(--text-tertiary)] disabled:opacity-20"
        >
          <NextTrackIcon className="h-4 w-4" />
        </button>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Volume — vertical amber slider */}
      <div className="flex flex-col items-center gap-1.5">
        <VolumeHigh className="h-3 w-3 text-[var(--text-tertiary)]" />
        <VerticalVolumeSlider volume={volume} onVolumeChange={applyVolume} />
      </div>

      {/* YouTube link — bottom of strip */}
      <a
        href={`https://www.youtube.com/watch?v=${currentTrack.video_id}`}
        target="_blank"
        rel="noopener noreferrer"
        title="Watch on YouTube"
        className="mt-3 flex w-full items-center justify-center gap-1 rounded py-1 text-[var(--text-tertiary)] transition-colors hover:bg-white/[0.04] hover:text-[var(--text-secondary)]"
      >
        <YouTubeLogo className="h-4 w-4 fill-current text-[#FF0000]" />
      </a>
    </aside>
  );
}

function VerticalVolumeSlider({
  volume,
  onVolumeChange,
}: {
  volume: number;
  onVolumeChange: (v: number) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  const calcVolume = useCallback(
    (clientY: number) => {
      if (!trackRef.current) return;
      const rect = trackRef.current.getBoundingClientRect();
      const pct = Math.round(((rect.bottom - clientY) / rect.height) * 100);
      onVolumeChange(Math.max(0, Math.min(100, pct)));
    },
    [onVolumeChange],
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      draggingRef.current = true;
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      calcVolume(e.clientY);
    },
    [calcVolume],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!draggingRef.current) return;
      calcVolume(e.clientY);
    },
    [calcVolume],
  );

  const handlePointerUp = useCallback(() => {
    draggingRef.current = false;
  }, []);

  return (
    <div
      ref={trackRef}
      className="group/vol relative h-16 w-4 cursor-pointer touch-none"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      {/* Track */}
      <div className="absolute inset-y-0 left-1/2 w-[3px] -translate-x-1/2 overflow-hidden rounded-full bg-[rgba(255,255,255,0.08)]">
        <div
          className="bg-primary absolute bottom-0 left-0 w-full rounded-full"
          style={{ height: `${volume}%` }}
        />
      </div>
      {/* Thumb — visible on hover and while dragging */}
      <div
        className="bg-primary absolute left-1/2 h-2.5 w-2.5 rounded-full opacity-0 shadow-sm transition-opacity group-hover/vol:opacity-100"
        style={{ bottom: `${volume}%`, transform: "translate(-50%, 50%)" }}
      />
    </div>
  );
}
