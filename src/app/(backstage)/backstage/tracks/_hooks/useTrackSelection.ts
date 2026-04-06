"use client";

import { useState } from "react";
import type { BackstageTrackRow } from "@/lib/db/repos/tracks";

export type TrackKey = `${string}::${string}`;

export function trackKey(t: { gameId: string; name: string }): TrackKey {
  return `${t.gameId}::${t.name}`;
}

export function useTrackSelection(tracks: BackstageTrackRow[]) {
  const [selected, setSelected] = useState<Set<TrackKey>>(new Set());

  const allSelected = tracks.length > 0 && tracks.every((t) => selected.has(trackKey(t)));

  function toggleAll() {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(tracks.map(trackKey)));
    }
  }

  function toggleOne(t: BackstageTrackRow) {
    const key = trackKey(t);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return {
    selected,
    setSelected,
    allSelected,
    toggleAll,
    toggleOne,
  };
}
