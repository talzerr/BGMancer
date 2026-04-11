import { PlaylistMode } from "@/types";

interface ModeLabel {
  name: string;
  description: string;
}

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

/** Display order for the mode selector. Journey first, then ascending energy. */
export const PLAYLIST_MODE_ORDER: readonly PlaylistMode[] = [
  PlaylistMode.Journey,
  PlaylistMode.Chill,
  PlaylistMode.Mix,
  PlaylistMode.Rush,
];
