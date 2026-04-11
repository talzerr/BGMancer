import { ArcPhase } from "@/types";
import type { ArcTemplate } from "../types";

export const MIX_ARC_TEMPLATE: ArcTemplate = [
  {
    phase: ArcPhase.Steady,
    fraction: 1,
    energyPrefs: [1, 2, 3],
    rolePrefs: [],
    preferredMoods: [],
    penalizedMoods: [],
    preferredInstrumentation: [],
  },
];
