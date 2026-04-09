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
  const { player, playlist, media, gameThumbnailByGameId } = usePlayerContext();

  const tracks = player.effectiveFoundTracks;
  const currentIndex = player.currentTrackIndex;
  const currentTrack = currentIndex !== null ? (tracks[currentIndex] ?? null) : null;
  const hasTrack = !!currentTrack;

  const isPlaying = media?.isPlaying ?? false;
  const currentTime = media?.currentTime ?? 0;
  const duration = media?.duration ?? 0;
  const volume = media?.volume ?? 100;

  const canPrev = hasTrack && currentIndex! > 0;
  const canNext = hasTrack && currentIndex! < tracks.length - 1;

  const safeDuration = isFinite(duration) && duration > 0 ? duration : 0;
  const fillPct = safeDuration > 0 ? (currentTime / safeDuration) * 100 : 0;

  const steamThumbnail = currentTrack
    ? (gameThumbnailByGameId?.get(currentTrack.game_id) ?? null)
    : null;
  const thumbnailSrc = steamThumbnail ?? currentTrack?.thumbnail ?? null;

  function handlePlayPause() {
    if (media) {
      media.togglePlayPause();
    } else if (playlist.tracks.length > 0) {
      player.startPlaying(playlist.tracks, 0, playlist.currentSessionId);
    }
  }

  return (
    <aside className="flex h-full w-20 shrink-0 flex-col items-center overflow-hidden border-l border-[rgba(255,255,255,0.04)] bg-[#13120f] px-2 pt-3 pb-5">
      {/* Cover art — clickable YouTube link when track is active */}
      {hasTrack ? (
        <a
          href={`https://www.youtube.com/watch?v=${currentTrack.video_id}`}
          target="_blank"
          rel="noopener noreferrer"
          title="Watch on YouTube"
          className="relative h-[44px] w-16 shrink-0 overflow-hidden rounded ring-1 ring-white/[0.06]"
        >
          {thumbnailSrc ? (
            <Image src={thumbnailSrc} alt="" fill className="object-cover" sizes="64px" />
          ) : (
            <div className="bg-secondary flex h-full w-full items-center justify-center">
              <MusicNote className="h-4 w-4 text-[var(--text-tertiary)]" />
            </div>
          )}
          <div className="absolute right-0 bottom-0 rounded-tl bg-black/50 px-1 py-0.5">
            <YouTubeLogo className="h-[12px] w-[12px] fill-current text-[#FF0000]" />
          </div>
        </a>
      ) : (
        <div className="flex h-[44px] w-16 shrink-0 items-center justify-center rounded bg-white/[0.04]" />
      )}

      {/* Track info */}
      {hasTrack && (
        <div className="mt-0.5 w-16 min-w-0 text-center">
          <p className="truncate text-[9px] leading-tight text-[var(--text-secondary)]">
            {currentTrack.track_name ?? currentTrack.video_title ?? ""}
          </p>
          <p className="truncate text-[8px] leading-tight text-[var(--text-disabled)]">
            {currentTrack.game_title}
          </p>
        </div>
      )}

      {/* Progress bar */}
      <div className={`w-full px-0.5 ${hasTrack ? "mt-2" : "mt-3"}`}>
        <div className="h-[2px] w-full overflow-hidden rounded-full bg-[rgba(255,255,255,0.08)]">
          {hasTrack && (
            <div className="bg-primary h-full rounded-full" style={{ width: `${fillPct}%` }} />
          )}
        </div>
        {hasTrack && (
          <div className="mt-0.5 flex justify-between font-mono text-[8px] text-[var(--text-tertiary)] tabular-nums">
            <span>{fmtTime(currentTime)}</span>
            <span>{fmtTime(safeDuration)}</span>
          </div>
        )}
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Transport controls */}
      <div className="flex flex-col items-center gap-2">
        <button
          onClick={() => canPrev && player.setCurrentTrackIndex(currentIndex! - 1)}
          disabled={!canPrev}
          aria-label="Previous track"
          className="cursor-pointer text-[var(--text-tertiary)] transition-colors duration-100 hover:text-[var(--text-secondary)] disabled:opacity-20"
        >
          <PrevTrackIcon className="h-[16px] w-[16px]" />
        </button>

        <button
          onClick={handlePlayPause}
          aria-label={isPlaying ? "Pause" : "Play"}
          className="bg-primary text-primary-foreground flex h-[30px] w-[30px] cursor-pointer items-center justify-center rounded-full transition-colors duration-100 hover:bg-[#B8882E]"
        >
          {isPlaying ? <PauseIcon className="h-3 w-3" /> : <PlayIcon className="h-3 w-3" />}
        </button>

        <button
          onClick={() => canNext && player.setCurrentTrackIndex(currentIndex! + 1)}
          disabled={!canNext}
          aria-label="Next track"
          className="cursor-pointer text-[var(--text-tertiary)] transition-colors duration-100 hover:text-[var(--text-secondary)] disabled:opacity-20"
        >
          <NextTrackIcon className="h-[16px] w-[16px]" />
        </button>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Volume */}
      <div className="flex flex-col items-center gap-1.5">
        <VolumeHigh className="h-3 w-3 text-[var(--text-tertiary)]" />
        <VerticalVolumeSlider volume={volume} onVolumeChange={media?.applyVolume ?? (() => {})} />
      </div>
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
