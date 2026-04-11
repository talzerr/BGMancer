import { ArcPhase, TrackMood } from "@/types";
import type { ArcTemplate } from "../types";

export const CHILL_ARC_TEMPLATE: ArcTemplate = [
  {
    phase: ArcPhase.Steady,
    fraction: 1,
    energyPrefs: [1, 2],
    rolePrefs: [],
    preferredMoods: [
      TrackMood.Peaceful,
      TrackMood.Serene,
      TrackMood.Nostalgic,
      TrackMood.Ethereal,
      TrackMood.Melancholic,
    ],
    penalizedMoods: [
      TrackMood.Chaotic,
      TrackMood.Epic,
      TrackMood.Tense,
      TrackMood.Heroic,
      TrackMood.Triumphant,
    ],
    preferredInstrumentation: [],
  },
];
