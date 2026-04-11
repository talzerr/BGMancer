import type { ArcPhase, TrackInstrumentation, TrackMood, TrackRole } from "@/types";

export interface ArcSlot {
  phase: ArcPhase;
  energyPrefs: Array<1 | 2 | 3>;
  rolePrefs: TrackRole[];
  preferredMoods: TrackMood[];
  penalizedMoods: TrackMood[];
  preferredInstrumentation: TrackInstrumentation[];
}

export interface ArcTemplatePhase {
  phase: ArcPhase;
  /** Share of the target track count allocated to this phase. Fractions sum to 1.0. */
  fraction: number;
  energyPrefs: Array<1 | 2 | 3>;
  rolePrefs: TrackRole[];
  preferredMoods: TrackMood[];
  penalizedMoods: TrackMood[];
  preferredInstrumentation: TrackInstrumentation[];
}

export type ArcTemplate = readonly ArcTemplatePhase[];
