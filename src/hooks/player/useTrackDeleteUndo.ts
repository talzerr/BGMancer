"use client";

import { useRef, useState } from "react";
import { usePlayerContext } from "@/context/player-context";
import { UNDO_TOAST_DURATION_MS } from "@/lib/constants";
import type { PlaylistTrack } from "@/types";

interface PendingDelete {
  track: PlaylistTrack;
  position: number;
}

/**
 * Manages optimistic track deletion with a timed undo toast.
 * Committing a new deletion immediately flushes any pending one.
 */
export function useTrackDeleteUndo() {
  const { playlist, player } = usePlayerContext();
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function initiateRemove(track: PlaylistTrack) {
    if (pendingDelete) {
      void fetch(`/api/playlist/${pendingDelete.track.id}`, { method: "DELETE" });
    }
    if (timerRef.current) clearTimeout(timerRef.current);

    if (track.id === player.playingTrackId) player.reset();
    const position = playlist.tracks.findIndex((t) => t.id === track.id);
    playlist.removeTrackLocal(track.id);
    setPendingDelete({ track, position });

    timerRef.current = setTimeout(() => {
      void fetch(`/api/playlist/${track.id}`, { method: "DELETE" });
      setPendingDelete(null);
    }, UNDO_TOAST_DURATION_MS);
  }

  function undoRemove() {
    if (!pendingDelete) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    playlist.restoreTrackLocal(pendingDelete.track, pendingDelete.position);
    setPendingDelete(null);
  }

  return { pendingDelete, initiateRemove, undoRemove };
}
