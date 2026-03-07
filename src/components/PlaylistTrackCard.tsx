"use client";

import Image from "next/image";
import type { PlaylistTrack } from "@/types";

interface PlaylistTrackCardProps {
  track: PlaylistTrack;
  index: number;
  isPlaying?: boolean;
  onPlay?: () => void;
}

const STATUS_DOT: Record<string, string> = {
  pending: "bg-zinc-500",
  searching: "bg-amber-400 animate-pulse",
  found: "bg-emerald-400",
  error: "bg-red-400",
};

export function PlaylistTrackCard({ track, index, isPlaying = false, onPlay }: PlaylistTrackCardProps) {
  const hasVideo = !!track.video_id;
  const isFullOST = track.track_name === null;

  return (
    <div
      className={`group flex items-center gap-3 rounded-xl border px-4 py-3 transition-colors ${
        isPlaying
          ? "bg-violet-950/40 border-violet-700/50"
          : track.status === "error"
          ? "bg-red-950/20 border-red-800/30"
          : "bg-zinc-800/60 border-zinc-700/50 hover:border-zinc-600"
      }`}
    >
      {/* Position */}
      <span className="shrink-0 w-7 text-center text-xs font-mono text-zinc-500 select-none">
        {index + 1}
      </span>

      {/* Thumbnail / play button */}
      <div className="shrink-0 w-14 h-10 rounded-md overflow-hidden bg-zinc-900 relative">
        {hasVideo && track.thumbnail ? (
          <button
            onClick={onPlay}
            disabled={!onPlay}
            className="block w-full h-full cursor-pointer disabled:cursor-default"
            aria-label={isPlaying ? "Now playing" : "Play track"}
          >
            <Image
              src={track.thumbnail}
              alt={track.video_title ?? ""}
              fill
              className="object-cover transition-transform duration-200 group-hover:scale-105"
              sizes="56px"
            />
            <div className={`absolute inset-0 flex items-center justify-center transition-opacity bg-black/50 ${isPlaying ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}>
              {isPlaying ? (
                <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                </svg>
              ) : (
                <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              )}
            </div>
          </button>
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <svg className="w-5 h-5 text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
            </svg>
          </div>
        )}
      </div>

      {/* Track info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <span className="text-xs text-zinc-500 truncate">{track.game_title}</span>
          {isFullOST && (
            <span className="shrink-0 text-xs font-medium px-1.5 py-0.5 rounded bg-violet-500/20 text-violet-300">
              Full OST
            </span>
          )}
        </div>
        {hasVideo && track.video_title ? (
          <button
            onClick={onPlay}
            disabled={!onPlay}
            className={`text-left text-sm font-medium line-clamp-1 transition-colors cursor-pointer disabled:cursor-default ${
              isPlaying ? "text-violet-300" : "text-white hover:text-violet-300"
            }`}
          >
            {track.video_title}
          </button>
        ) : track.status === "error" ? (
          <p className="text-xs text-red-400 line-clamp-1">{track.error_message ?? "Search failed"}</p>
        ) : (
          <p className="text-sm text-zinc-400 line-clamp-1">
            {track.track_name ?? (isFullOST ? "Searching for compilation…" : "Pending search")}
          </p>
        )}
        {hasVideo && track.channel_title && (
          <p className="text-xs text-zinc-500 mt-0.5 truncate">{track.channel_title}</p>
        )}
      </div>

      {/* Status indicator */}
      <div className={`shrink-0 w-2 h-2 rounded-full ${STATUS_DOT[track.status] ?? STATUS_DOT.pending}`} />
    </div>
  );
}
