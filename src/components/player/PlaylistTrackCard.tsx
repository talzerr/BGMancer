"use client";

import Image from "next/image";
import type { PlaylistTrack } from "@/types";
import {
  YouTubeLogo,
  MusicNoteOutline,
  PlayIcon,
  PauseIcon,
  XIcon,
  RefreshIcon,
  Spinner,
  GripIcon,
} from "@/components/Icons";

interface PlaylistTrackCardProps {
  track: PlaylistTrack;
  index: number;
  /** Game cover thumbnail URL (Steam header) shown instead of the YouTube video thumbnail */
  gameThumbnail?: string;
  /** true when this is the currently selected track (highlights the card) */
  isPlaying?: boolean;
  /** true when this track is actively playing (not paused) — drives waves + overlay icon */
  isActivelyPlaying?: boolean;
  /** true when anti-spoiler mode is on and this track hasn't been played yet */
  spoilerHidden?: boolean;
  onPlay?: () => void;
  onRemove?: () => void;
  onReroll?: () => void;
  /** true while an AI reroll is in flight for this track */
  isRerolling?: boolean;
  /** Props to spread onto the drag handle element (from @dnd-kit useSortable) */
  dragHandleProps?: React.HTMLAttributes<HTMLElement>;
  /** true while this card is being dragged */
  isDragging?: boolean;
}

function formatTrackDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function PlaylistTrackCard({
  track,
  index: _index,
  gameThumbnail,
  isPlaying = false,
  isActivelyPlaying = false,
  spoilerHidden = false,
  onPlay,
  onRemove,
  onReroll,
  isRerolling = false,
  dragHandleProps,
  isDragging = false,
}: PlaylistTrackCardProps) {
  const hasVideo = !!track.video_id;
  const isImported = track.game_title === "YouTube Import";
  const thumbnailSrc = gameThumbnail ?? track.thumbnail;

  const isPlayable = hasVideo && !!onPlay;

  const durationText =
    track.duration_seconds != null && track.duration_seconds > 0
      ? formatTrackDuration(track.duration_seconds)
      : null;

  return (
    <div
      onClick={isPlayable ? onPlay : undefined}
      className={`group relative flex items-center gap-4 border-b border-[rgba(255,255,255,0.04)] px-3 py-[10px] transition-all duration-150 ${
        isPlayable ? "cursor-pointer" : ""
      } ${isDragging ? "opacity-50" : ""} bg-white/[0.02] hover:bg-white/[0.04]`}
    >
      {/* Now-playing left bar */}
      {isPlaying && (
        <div className="bg-primary absolute top-0 bottom-0 left-0 w-[3px] rounded-r-sm" />
      )}

      {/* Drag handle */}
      {dragHandleProps && (
        <div
          {...dragHandleProps}
          onClick={(e) => e.stopPropagation()}
          className="shrink-0 cursor-grab touch-none opacity-0 transition-opacity group-hover:opacity-40 hover:!opacity-100 active:cursor-grabbing"
        >
          <GripIcon className="text-muted-foreground h-3.5 w-3.5" />
        </div>
      )}

      {/* Thumbnail */}
      <div className="bg-secondary relative h-[44px] w-16 shrink-0 overflow-hidden rounded-[6px] ring-1 ring-white/[0.06]">
        {hasVideo && thumbnailSrc ? (
          <>
            <Image
              src={thumbnailSrc}
              alt={track.game_title ?? track.video_title ?? ""}
              fill
              className={`object-cover transition-all duration-300 ${spoilerHidden ? "scale-110 blur-md" : ""}`}
              sizes="64px"
            />
            {/* Play/pause overlay */}
            <div
              className={`absolute inset-0 flex items-center justify-center bg-black/50 transition-opacity ${isPlaying ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
            >
              {isActivelyPlaying ? (
                <PauseIcon className="h-4 w-4 text-white drop-shadow" />
              ) : (
                <PlayIcon className="h-4 w-4 text-white drop-shadow" />
              )}
            </div>
            {/* YouTube attribution */}
            <div className="absolute right-0 bottom-0 flex items-center gap-0.5 rounded-tl bg-black/70 px-1 py-0.5 opacity-0 transition-opacity group-hover:opacity-100">
              <YouTubeLogo className="h-2 w-2 shrink-0 fill-current text-[#FF0000]" />
              <span className="text-[8px] leading-none font-medium text-white">YouTube</span>
            </div>
            {/* Now-playing equalizer on cover art */}
            {isPlaying && (
              <div className="absolute bottom-[3px] left-[3px] flex items-end gap-[1.5px] rounded-sm bg-black/40 px-[2px] py-[1px]">
                <span className={isActivelyPlaying ? "eq-bar-sm" : "eq-bar-sm eq-bar-paused"} />
                <span className={isActivelyPlaying ? "eq-bar-sm" : "eq-bar-sm eq-bar-paused"} />
                <span className={isActivelyPlaying ? "eq-bar-sm" : "eq-bar-sm eq-bar-paused"} />
              </div>
            )}
          </>
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <MusicNoteOutline className="h-5 w-5 text-[var(--text-tertiary)]" />
          </div>
        )}
      </div>

      {/* Track info */}
      <div className="min-w-0 flex-1">
        {spoilerHidden ? (
          <p className="line-clamp-1 text-[15px] leading-snug font-normal -tracking-[0.01em] text-[var(--text-primary)] blur-sm select-none">
            {track.track_name ?? track.video_title}
          </p>
        ) : (
          <p className="line-clamp-1 text-[15px] leading-snug font-normal -tracking-[0.01em] text-[var(--text-primary)]">
            {track.track_name ?? track.video_title}
          </p>
        )}
        <p
          className={`mt-1 truncate text-[13px] text-[var(--text-tertiary)] ${spoilerHidden ? "blur-sm select-none" : ""}`}
        >
          from {track.game_title}
          {durationText && ` · ${durationText}`}
        </p>
      </div>

      {/* Right side: action buttons */}
      <div className="flex shrink-0 items-center gap-0.5">
        {onReroll && (
          <div className="group/reroll relative ml-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onReroll();
              }}
              disabled={isRerolling || isImported}
              className="hover:text-foreground flex h-6 w-6 cursor-pointer items-center justify-center rounded-md text-[var(--text-tertiary)] opacity-0 transition-opacity group-hover:opacity-100 hover:bg-[var(--surface-hover)]/60 disabled:cursor-not-allowed disabled:opacity-30"
            >
              {isRerolling ? <Spinner className="h-3 w-3" /> : <RefreshIcon className="h-3 w-3" />}
            </button>
            <div className="bg-secondary text-foreground pointer-events-none absolute bottom-full left-1/2 z-50 mb-1.5 -translate-x-1/2 rounded-md border border-[var(--border-emphasis)] px-2 py-1 text-[11px] whitespace-nowrap opacity-0 transition-opacity group-hover/reroll:opacity-100">
              {isImported ? "Imported tracks cannot be rerolled" : "Replace with a different track"}
            </div>
          </div>
        )}

        {onRemove && (
          <div className="group/remove relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRemove();
              }}
              className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-md text-[var(--text-tertiary)] opacity-0 transition-opacity group-hover:opacity-100 hover:bg-red-900/40 hover:text-red-400"
            >
              <XIcon className="h-3 w-3" />
            </button>
            <div className="bg-secondary text-foreground pointer-events-none absolute bottom-full left-1/2 z-50 mb-1.5 -translate-x-1/2 rounded-md border border-[var(--border-emphasis)] px-2 py-1 text-[11px] whitespace-nowrap opacity-0 transition-opacity group-hover/remove:opacity-100">
              Remove from playlist
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
