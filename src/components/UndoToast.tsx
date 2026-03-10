import { UNDO_TOAST_DURATION_MS } from "@/lib/constants";
import type { PlaylistTrack } from "@/types";

interface UndoToastProps {
  track: PlaylistTrack;
  onUndo: () => void;
}

export function UndoToast({ track, onUndo }: UndoToastProps) {
  return (
    <div className="fixed right-4 bottom-24 z-50 flex items-center gap-3 rounded-xl border border-white/[0.08] bg-zinc-900 px-4 py-2.5 shadow-2xl shadow-black/60">
      <span className="text-sm text-zinc-300">
        <span className="font-medium text-white">
          {track.track_name ?? track.video_title ?? "Track"}
        </span>{" "}
        removed
      </span>
      <div className="h-3.5 w-px bg-zinc-700" />
      <button
        onClick={onUndo}
        className="cursor-pointer text-sm font-semibold text-teal-400 hover:text-teal-300"
      >
        Undo
      </button>
      {/* key on the countdown bar forces remount so the animation restarts on each deletion */}
      <div className="absolute right-0 bottom-0 left-0 h-0.5 overflow-hidden rounded-b-xl bg-zinc-800">
        <div
          key={track.id}
          className="h-full bg-teal-500"
          style={{
            animation: `shrink ${UNDO_TOAST_DURATION_MS}ms linear forwards`,
            transformOrigin: "left",
          }}
        />
      </div>
    </div>
  );
}
