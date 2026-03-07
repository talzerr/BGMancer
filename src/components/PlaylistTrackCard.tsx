"use client";

import Image from "next/image";
import type { PlaylistTrack, VibePreference } from "@/types";

interface PlaylistTrackCardProps {
  track: PlaylistTrack;
  index: number;
  vibe?: VibePreference;
  /** true when this is the currently selected track (highlights the card) */
  isPlaying?: boolean;
  /** true when this track is actively playing (not paused) — drives waves + overlay icon */
  isActivelyPlaying?: boolean;
  onPlay?: () => void;
}

const STATUS_CONFIG: Record<string, { dot: string }> = {
  pending:   { dot: "bg-zinc-500" },
  searching: { dot: "bg-amber-400 animate-pulse" },
  found:     { dot: "bg-emerald-400" },
  error:     { dot: "bg-red-400" },
};

// Left accent border color per vibe — subtle scan-cue for the playlist
const VIBE_ACCENT: Record<VibePreference, string> = {
  official_soundtrack: "border-l-violet-500/50",
  boss_themes:         "border-l-red-500/50",
  ambient_exploration: "border-l-sky-500/50",
};

export function PlaylistTrackCard({
  track,
  index,
  vibe,
  isPlaying = false,
  isActivelyPlaying = false,
  onPlay,
}: PlaylistTrackCardProps) {
  const hasVideo = !!track.video_id;
  const isFullOST = track.track_name === null;
  const statusCfg = STATUS_CONFIG[track.status] ?? STATUS_CONFIG.pending;
  const vibeAccent = vibe ? VIBE_ACCENT[vibe] : "border-l-transparent";

  return (
    <div
      className={`group flex items-center gap-3 rounded-xl border border-l-2 px-3 py-2.5 transition-all duration-150 ${vibeAccent} ${
        isPlaying
          ? "bg-violet-950/50 border-violet-600/40 shadow-sm shadow-violet-900/20"
          : track.status === "error"
          ? "bg-red-950/20 border-red-800/30"
          : "bg-zinc-900/60 border-white/[0.05] hover:border-white/[0.10] hover:bg-zinc-900/80"
      }`}
    >
      {/* Position number → waves when actively playing */}
      <div className="shrink-0 w-6 flex items-center justify-center">
        {isPlaying ? (
          <div className="flex items-end gap-px h-[14px]">
            <span className={`eq-bar${!isActivelyPlaying ? " eq-bar-paused" : ""}`} />
            <span className={`eq-bar${!isActivelyPlaying ? " eq-bar-paused" : ""}`} />
            <span className={`eq-bar${!isActivelyPlaying ? " eq-bar-paused" : ""}`} />
          </div>
        ) : (
          <span className="text-xs font-mono text-zinc-500 select-none">{index + 1}</span>
        )}
      </div>

      {/* Thumbnail / play button */}
      <div className="shrink-0 w-16 h-11 rounded-lg overflow-hidden bg-zinc-800 relative ring-1 ring-white/[0.06]">
        {hasVideo && track.thumbnail ? (
          <button
            onClick={onPlay}
            disabled={!onPlay}
            className="block w-full h-full cursor-pointer disabled:cursor-default"
            aria-label={isActivelyPlaying ? "Pause" : isPlaying ? "Resume" : "Play track"}
          >
            <Image
              src={track.thumbnail}
              alt={track.video_title ?? ""}
              fill
              className="object-cover"
              sizes="64px"
            />
            {/* Play/pause/resume overlay */}
            <div className={`absolute inset-0 flex items-center justify-center bg-black/50 transition-opacity ${isPlaying ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}>
              {isActivelyPlaying ? (
                <svg className="w-4 h-4 text-white drop-shadow" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                </svg>
              ) : (
                <svg className="w-4 h-4 text-white drop-shadow" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              )}
            </div>
            {/* YouTube attribution */}
            <div className="absolute bottom-0 right-0 flex items-center gap-0.5 bg-black/70 px-1 py-0.5 rounded-tl opacity-0 group-hover:opacity-100 transition-opacity">
              <svg className="w-2 h-2 text-[#FF0000] fill-current shrink-0" viewBox="0 0 24 24">
                <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
              </svg>
              <span className="text-[8px] font-medium text-white leading-none">YouTube</span>
            </div>
          </button>
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <svg className="w-5 h-5 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
            </svg>
          </div>
        )}
      </div>

      {/* Track info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <span className="text-[11px] text-zinc-400 truncate leading-none">{track.game_title}</span>
          {isFullOST && (
            <span className="shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-violet-500/15 text-violet-400 border border-violet-500/20 leading-none">
              Full OST
            </span>
          )}
        </div>
        {hasVideo && track.video_title ? (
          <button
            onClick={onPlay}
            disabled={!onPlay}
            className={`text-left text-sm font-medium line-clamp-1 leading-tight cursor-pointer disabled:cursor-default ${
              isPlaying ? "text-violet-300" : "text-zinc-100 hover:text-violet-300"
            }`}
          >
            {track.video_title}
          </button>
        ) : track.status === "error" ? (
          <p className="text-xs text-red-400/80 line-clamp-1 leading-tight">{track.error_message ?? "Search failed"}</p>
        ) : (
          <p className="text-sm text-zinc-400 line-clamp-1 leading-tight">
            {track.track_name ?? (isFullOST ? "Finding compilation…" : "Pending search")}
          </p>
        )}
        {hasVideo && track.channel_title && (
          <p className="text-[11px] text-zinc-500 mt-0.5 truncate leading-none">{track.channel_title}</p>
        )}
      </div>

      {/* Status dot */}
      <div className={`shrink-0 w-1.5 h-1.5 rounded-full ${statusCfg.dot}`} />
    </div>
  );
}
