import { ArcPhase, TrackInstrumentation, TrackMood, TrackRole } from "@/types";
import type { ArcTemplate } from "../types";

/**
 * Journey — the default six-phase narrative arc. Shapes a playlist that opens
 * quietly, rises, peaks, falls, climaxes, and closes out. This is BGMancer's
 * identity mode.
 */
export const JOURNEY_ARC_TEMPLATE: ArcTemplate = [
  {
    phase: ArcPhase.Intro,
    fraction: 0.15,
    energyPrefs: [1, 2],
    rolePrefs: [TrackRole.Opener, TrackRole.Menu, TrackRole.Ambient],
    preferredMoods: [TrackMood.Peaceful, TrackMood.Mysterious, TrackMood.Nostalgic],
    penalizedMoods: [TrackMood.Chaotic, TrackMood.Epic],
    preferredInstrumentation: [
      TrackInstrumentation.Piano,
      TrackInstrumentation.Ambient,
      TrackInstrumentation.Strings,
    ],
  },
  {
    phase: ArcPhase.Rising,
    fraction: 0.25,
    energyPrefs: [2],
    rolePrefs: [TrackRole.Build, TrackRole.Ambient, TrackRole.Cinematic],
    preferredMoods: [TrackMood.Mysterious, TrackMood.Tense, TrackMood.Melancholic],
    penalizedMoods: [TrackMood.Playful, TrackMood.Whimsical],
    preferredInstrumentation: [
      TrackInstrumentation.Orchestral,
      TrackInstrumentation.Strings,
      TrackInstrumentation.Synth,
    ],
  },
  {
    phase: ArcPhase.Peak,
    fraction: 0.25,
    energyPrefs: [2, 3],
    rolePrefs: [TrackRole.Combat, TrackRole.Build, TrackRole.Cinematic],
    preferredMoods: [TrackMood.Epic, TrackMood.Tense, TrackMood.Heroic],
    penalizedMoods: [TrackMood.Peaceful, TrackMood.Serene, TrackMood.Whimsical],
    preferredInstrumentation: [
      TrackInstrumentation.Orchestral,
      TrackInstrumentation.Rock,
      TrackInstrumentation.Metal,
    ],
  },
  {
    phase: ArcPhase.Valley,
    fraction: 0.15,
    energyPrefs: [1, 2],
    rolePrefs: [TrackRole.Ambient, TrackRole.Cinematic],
    preferredMoods: [TrackMood.Peaceful, TrackMood.Serene, TrackMood.Melancholic],
    penalizedMoods: [TrackMood.Epic, TrackMood.Chaotic, TrackMood.Heroic],
    preferredInstrumentation: [
      TrackInstrumentation.Ambient,
      TrackInstrumentation.Piano,
      TrackInstrumentation.Acoustic,
    ],
  },
  {
    phase: ArcPhase.Climax,
    fraction: 0.1,
    energyPrefs: [3],
    rolePrefs: [TrackRole.Combat, TrackRole.Cinematic],
    preferredMoods: [TrackMood.Epic, TrackMood.Heroic, TrackMood.Triumphant, TrackMood.Chaotic],
    penalizedMoods: [TrackMood.Peaceful, TrackMood.Playful],
    preferredInstrumentation: [
      TrackInstrumentation.Orchestral,
      TrackInstrumentation.Metal,
      TrackInstrumentation.Choir,
    ],
  },
  {
    phase: ArcPhase.Outro,
    fraction: 0.1,
    energyPrefs: [1],
    rolePrefs: [TrackRole.Closer, TrackRole.Ambient, TrackRole.Menu],
    preferredMoods: [TrackMood.Melancholic, TrackMood.Nostalgic, TrackMood.Peaceful],
    penalizedMoods: [TrackMood.Chaotic, TrackMood.Tense],
    preferredInstrumentation: [
      TrackInstrumentation.Piano,
      TrackInstrumentation.Acoustic,
      TrackInstrumentation.Strings,
    ],
  },
];
