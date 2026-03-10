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

const STATUS_CONFIG: Record<string, { dot: string }> = {
  pending: { dot: "bg-zinc-500" },
  searching: { dot: "bg-amber-400 animate-pulse" },
  found: { dot: "bg-emerald-400" },
  error: { dot: "bg-red-400" },
};

export function PlaylistTrackCard({
  track,
  index,
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
  const isFullOST = track.track_name === null;
  const statusCfg = STATUS_CONFIG[track.status] ?? STATUS_CONFIG.pending;
  const thumbnailSrc = gameThumbnail ?? track.thumbnail;

  const isPlayable = hasVideo && !!onPlay;

  return (
    <div
      onClick={isPlayable ? onPlay : undefined}
      className={`group flex items-center gap-3 rounded-xl border border-l-2 border-l-transparent px-3 py-2 transition-all duration-150 ${
        isPlayable ? "cursor-pointer" : ""
      } ${isDragging ? "opacity-50 shadow-lg shadow-black/40" : ""} ${
        isPlaying
          ? "border-violet-600/40 bg-violet-950/50 shadow-sm shadow-violet-900/20"
          : track.status === "error"
            ? "border-red-800/30 bg-red-950/20"
            : "border-white/[0.05] bg-zinc-900/60 hover:border-white/[0.10] hover:bg-zinc-900/80"
      }`}
    >
      {/* Drag handle */}
      {dragHandleProps && (
        <div
          {...dragHandleProps}
          onClick={(e) => e.stopPropagation()}
          className="shrink-0 cursor-grab touch-none opacity-0 transition-opacity group-hover:opacity-40 hover:!opacity-100 active:cursor-grabbing"
        >
          <GripIcon className="h-3.5 w-3.5 text-zinc-400" />
        </div>
      )}

      {/* Position number -> waves when actively playing */}
      <div className="flex w-6 shrink-0 items-center justify-center">
        {isPlaying ? (
          <div className="flex h-[14px] items-end gap-px">
            <span className={`eq-bar${!isActivelyPlaying ? "eq-bar-paused" : ""}`} />
            <span className={`eq-bar${!isActivelyPlaying ? "eq-bar-paused" : ""}`} />
            <span className={`eq-bar${!isActivelyPlaying ? "eq-bar-paused" : ""}`} />
          </div>
        ) : (
          <span className="font-mono text-xs text-zinc-500 select-none">{index + 1}</span>
        )}
      </div>

      {/* Thumbnail */}
      <div className="relative h-11 w-16 shrink-0 overflow-hidden rounded-lg bg-zinc-800 ring-1 ring-white/[0.06]">
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
          </>
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <MusicNoteOutline className="h-5 w-5 text-zinc-500" />
          </div>
        )}
      </div>

      {/* Track info */}
      <div className="min-w-0 flex-1">
        <div className="mb-0.5 flex items-center gap-1.5">
          <span
            className={`truncate text-[11px] leading-none text-zinc-400 ${spoilerHidden ? "blur-sm select-none" : ""}`}
          >
            {track.game_title}
          </span>
          {isFullOST && !spoilerHidden && (
            <span className="shrink-0 rounded-full border border-violet-500/20 bg-violet-500/15 px-1.5 py-0.5 text-[10px] leading-none font-semibold text-violet-400">
              Full OST
            </span>
          )}
        </div>
        {hasVideo && track.video_title ? (
          spoilerHidden ? (
            <p className="line-clamp-1 text-sm leading-tight font-medium text-zinc-400 blur-sm select-none">
              {track.track_name ?? track.video_title}
            </p>
          ) : (
            <p
              className={`line-clamp-1 text-sm leading-tight font-medium ${
                isPlaying ? "text-violet-300" : "text-zinc-100"
              }`}
            >
              {track.track_name ?? track.video_title}
            </p>
          )
        ) : track.status === "error" ? (
          <p className="line-clamp-1 text-xs leading-tight text-red-400/80">
            {track.error_message ?? "Search failed"}
          </p>
        ) : (
          <p className="line-clamp-1 text-sm leading-tight text-zinc-400">
            {track.track_name ?? (isFullOST ? "Finding compilation…" : "Pending search")}
          </p>
        )}
        {hasVideo && track.channel_title && !spoilerHidden && (
          <p className="mt-0.5 truncate text-[11px] leading-none text-zinc-400">
            {track.channel_title}
          </p>
        )}
      </div>

      {/* Right side: status dot + action buttons */}
      <div className="flex shrink-0 items-center gap-0.5">
        {track.status !== "found" && (
          <div className={`h-1.5 w-1.5 shrink-0 rounded-full ${statusCfg.dot}`} />
        )}

        {onReroll && (
          <div className="group/reroll relative ml-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onReroll();
              }}
              disabled={isRerolling || track.status === "searching"}
              className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-md text-zinc-500 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-zinc-700/60 hover:text-zinc-300 disabled:cursor-not-allowed disabled:opacity-30"
            >
              {isRerolling ? <Spinner className="h-3 w-3" /> : <RefreshIcon className="h-3 w-3" />}
            </button>
            <div className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-1.5 -translate-x-1/2 rounded-md border border-white/[0.08] bg-zinc-900 px-2 py-1 text-[11px] whitespace-nowrap text-zinc-300 opacity-0 shadow-lg shadow-black/40 transition-opacity group-hover/reroll:opacity-100">
              Replace with a different track
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
              disabled={track.status === "searching"}
              className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-md text-zinc-500 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-red-900/40 hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-30"
            >
              <XIcon className="h-3 w-3" />
            </button>
            <div className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-1.5 -translate-x-1/2 rounded-md border border-white/[0.08] bg-zinc-900 px-2 py-1 text-[11px] whitespace-nowrap text-zinc-300 opacity-0 shadow-lg shadow-black/40 transition-opacity group-hover/remove:opacity-100">
              Remove from playlist
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
