import { PlaylistMode } from "@/types";

interface ModeLabel {
  name: string;
  description: string;
}

/** Display labels and descriptions for every playlist mode. Insertion order
 *  is the canonical display order — Journey first, then ascending energy —
 *  and `PLAYLIST_MODE_ORDER` derives from it so the two cannot drift. */
export const PLAYLIST_MODE_LABELS: Record<PlaylistMode, ModeLabel> = {
  [PlaylistMode.Journey]: {
    name: "Journey",
    description: "The full BGMancer experience — a playlist shaped by your games",
  },
  [PlaylistMode.Chill]: {
    name: "Chill",
    description: "Background music for work, study, or winding down",
  },
  [PlaylistMode.Mix]: {
    name: "Mix",
    description: "A steady mix for long sessions and grinding",
  },
  [PlaylistMode.Rush]: {
    name: "Rush",
    description: "High energy for workouts and intense gaming",
  },
};

export const PLAYLIST_MODE_ORDER = Object.keys(PLAYLIST_MODE_LABELS) as readonly PlaylistMode[];
