import { UNDO_TOAST_DURATION_MS } from "@/lib/constants";
import type { PlaylistTrack } from "@/types";

interface UndoToastProps {
  track: PlaylistTrack;
  onUndo: () => void;
}

export function UndoToast({ track, onUndo }: UndoToastProps) {
  return (
    <div className="bg-secondary fixed right-4 bottom-24 z-50 flex items-center gap-3 rounded-xl border border-[var(--border-emphasis)] px-4 py-2.5">
      <span className="text-foreground text-sm">
        <span className="text-foreground font-medium">
          {track.track_name ?? track.video_title ?? "Track"}
        </span>{" "}
        removed
      </span>
      <div className="h-3.5 w-px bg-[var(--border-emphasis)]" />
      <button
        onClick={onUndo}
        className="text-primary cursor-pointer text-sm font-medium hover:text-[var(--primary-hover)]"
      >
        Undo
      </button>
      {/* key on the countdown bar forces remount so the animation restarts on each deletion */}
      <div className="absolute right-0 bottom-0 left-0 h-0.5 overflow-hidden rounded-b-xl bg-[var(--surface-hover)]">
        <div
          key={track.id}
          className="bg-primary h-full"
          style={{
            animation: `shrink ${UNDO_TOAST_DURATION_MS}ms linear forwards`,
            transformOrigin: "left",
          }}
        />
      </div>
    </div>
  );
}
