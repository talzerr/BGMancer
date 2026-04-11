import type { ArcPhase, TrackInstrumentation, TrackMood, TrackRole } from "@/types";

/** A single slot in an expanded arc — the per-position constraints the
 *  Director uses to filter and score candidate tracks. */
export interface ArcSlot {
  phase: ArcPhase;
  energyPrefs: Array<1 | 2 | 3>;
  rolePrefs: TrackRole[];
  preferredMoods: TrackMood[];
  penalizedMoods: TrackMood[];
  preferredInstrumentation: TrackInstrumentation[];
}

/** A single phase of an arc template. Defines what kinds of tracks fill the
 *  corresponding slots: energy, preferred roles, mood preferences and penalties,
 *  instrumentation preferences. `fraction` is the share of the target track
 *  count allocated to this phase (sums to 1.0 across all phases in a template). */
export interface ArcTemplatePhase {
  phase: ArcPhase;
  fraction: number;
  energyPrefs: Array<1 | 2 | 3>;
  rolePrefs: TrackRole[];
  preferredMoods: TrackMood[];
  penalizedMoods: TrackMood[];
  preferredInstrumentation: TrackInstrumentation[];
}

/** An arc template is a sequence of phases. The Director accepts any
 *  template — the shape of a playlist is a function of the template it's
 *  built from. */
export type ArcTemplate = readonly ArcTemplatePhase[];
