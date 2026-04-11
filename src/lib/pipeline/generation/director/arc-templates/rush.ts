import { ArcPhase, TrackMood } from "@/types";
import type { ArcTemplate } from "../types";

export const RUSH_ARC_TEMPLATE: ArcTemplate = [
  {
    phase: ArcPhase.Steady,
    fraction: 1,
    energyPrefs: [2, 3],
    rolePrefs: [],
    preferredMoods: [
      TrackMood.Epic,
      TrackMood.Tense,
      TrackMood.Heroic,
      TrackMood.Triumphant,
      TrackMood.Chaotic,
    ],
    penalizedMoods: [TrackMood.Peaceful, TrackMood.Serene, TrackMood.Ethereal],
    preferredInstrumentation: [],
  },
];
