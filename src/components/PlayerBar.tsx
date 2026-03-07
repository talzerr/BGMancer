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
                <YouTubeLogo className="w-2 h-2 text-[#FF0000] fill-current shrink-0" />
                <span className="text-[8px] font-medium text-white leading-none tracking-tight">YouTube</span>
              </div>
            </div>
          ) : (
            <div className="w-14 h-10 shrink-0 rounded-md bg-zinc-800 ring-1 ring-white/10 flex items-center justify-center">
              <MusicNote className="w-5 h-5 text-zinc-500" />
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
              <PrevTrackIcon />
            </button>

            <button
              onClick={yt.togglePlayPause}
              aria-label={yt.isPlaying ? "Pause" : "Play"}
              className="p-2.5 rounded-full bg-violet-600 hover:bg-violet-500 text-white shadow-lg shadow-violet-900/40 cursor-pointer"
            >
              {yt.isPlaying ? <PauseIcon /> : <PlayIcon />}
            </button>

            <button
              onClick={() => canNext && onIndexChange(currentIndex + 1)}
              disabled={!canNext}
              aria-label="Next track"
              className="p-2 rounded-full text-zinc-500 hover:text-white disabled:opacity-20 cursor-pointer disabled:cursor-default"
            >
              <NextTrackIcon />
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
              <ShuffleIcon />
            </button>
          )}

          <button
            onClick={yt.toggleDim}
            title={yt.dimmed ? "Restore volume" : "Dim to 20%"}
            className={`p-1.5 rounded-md cursor-pointer transition-colors ${
              yt.dimmed ? "text-amber-400 bg-amber-500/15" : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/80"
            }`}
          >
            {yt.dimmed ? <VolumeMuted /> : <VolumeLow />}
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
            <YouTubeLogo className="w-3 h-3 text-[#FF0000] fill-current" />
            <span className="hidden sm:inline">YouTube</span>
          </a>

          <button
            onClick={onClose}
            title="Close player"
            className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/80 cursor-pointer"
          >
            <CloseIcon />
          </button>
        </div>
      </div>
    </div>
  );
});
