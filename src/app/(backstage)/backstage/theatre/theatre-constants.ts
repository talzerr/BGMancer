import type { PlaylistTrack, TrackDecision, VibeRubric, PlaylistSession } from "@/types";
import { ArcPhase, SelectionPass } from "@/types";
import {
  SCORE_WEIGHT_ROLE,
  SCORE_WEIGHT_MOOD,
  SCORE_WEIGHT_INSTRUMENT,
  SCORE_WEIGHT_ROLE_VIEW_BIAS,
  SCORE_WEIGHT_MOOD_VIEW_BIAS,
  SCORE_WEIGHT_VIEW_BIAS,
  SCORE_WEIGHT_INSTRUMENT_VIEW_BIAS,
} from "@/lib/constants";

// ─── Types ──────────────────────────────────────────────────────────────────────

export interface SessionSummary extends PlaylistSession {
  track_count: number;
}

export interface PlaylistTelemetry {
  session: { id: string; name: string; created_at: string };
  tracks: PlaylistTrack[];
  decisions: TrackDecision[];
  gameBudgets: Record<string, number> | null;
  rubric: VibeRubric | null;
}

// ─── Color maps ─────────────────────────────────────────────────────────────────

export const PHASE_COLORS: Record<string, string> = {
  [ArcPhase.Intro]: "bg-sky-900/40 border-sky-700/30",
  [ArcPhase.Rising]: "bg-amber-900/40 border-amber-700/30",
  [ArcPhase.Peak]: "bg-orange-900/40 border-orange-700/30",
  [ArcPhase.Valley]: "bg-emerald-900/40 border-emerald-700/30",
  [ArcPhase.Climax]: "bg-rose-900/40 border-rose-700/30",
  [ArcPhase.Outro]: "bg-primary/10 border-primary/30",
};

export const PHASE_TEXT: Record<string, string> = {
  [ArcPhase.Intro]: "text-sky-400",
  [ArcPhase.Rising]: "text-amber-400",
  [ArcPhase.Peak]: "text-orange-400",
  [ArcPhase.Valley]: "text-emerald-400",
  [ArcPhase.Climax]: "text-rose-400",
  [ArcPhase.Outro]: "text-primary",
};

export const PASS_STYLES: Record<string, { label: string; cls: string }> = {
  [SelectionPass.Scored]: {
    label: "scored",
    cls: "border-emerald-700/50 bg-emerald-500/10 text-emerald-400",
  },
  [SelectionPass.FocusPre]: {
    label: "focus",
    cls: "border-primary/50 bg-primary/10 text-primary",
  },
  [SelectionPass.Fallback]: {
    label: "fallback",
    cls: "border-amber-700/50 bg-amber-500/10 text-amber-400",
  },
  [SelectionPass.LastResort]: {
    label: "last resort",
    cls: "border-rose-700/50 bg-rose-500/10 text-rose-400",
  },
};

export const ENERGY_COLORS: Record<number, string> = {
  1: "bg-sky-500/20 text-sky-300 border-sky-500/30",
  2: "bg-amber-500/20 text-amber-300 border-amber-500/30",
  3: "bg-rose-500/20 text-rose-300 border-rose-500/30",
};

// ─── Utilities ──────────────────────────────────────────────────────────────────

export function gameHue(gameId: string): number {
  let hash = 0;
  for (let i = 0; i < gameId.length; i++) hash = (hash * 31 + gameId.charCodeAt(i)) | 0;
  return Math.abs(hash) % 360;
}

interface ScoringWeightRow {
  dimension: string;
  weight: string;
  method: string;
}

const w = (a: number, b: number) => `${a.toFixed(2)} / ${b.toFixed(2)}`;

export const SCORING_WEIGHTS: ScoringWeightRow[] = [
  {
    dimension: "Role",
    weight: w(SCORE_WEIGHT_ROLE, SCORE_WEIGHT_ROLE_VIEW_BIAS),
    method: "Binary -- 1.0 if role matches slot, 0.0 otherwise",
  },
  {
    dimension: "Mood",
    weight: w(SCORE_WEIGHT_MOOD, SCORE_WEIGHT_MOOD_VIEW_BIAS),
    method: "Jaccard similarity on mood intersection",
  },
  {
    dimension: "Instrumentation",
    weight: w(SCORE_WEIGHT_INSTRUMENT, SCORE_WEIGHT_INSTRUMENT_VIEW_BIAS),
    method: "Jaccard similarity on instrumentation intersection",
  },
  {
    dimension: "View Bias",
    weight: `— / ${SCORE_WEIGHT_VIEW_BIAS.toFixed(2)}`,
    method: "YouTube view count popularity (global heat + local stature)",
  },
];

export const BUDGET_RULES = [
  { mode: "Focus", weight: "2.0x", color: "text-primary" },
  { mode: "Include", weight: "1.0x", color: "text-foreground" },
  { mode: "Lite", weight: "0.5x", color: "text-[var(--text-tertiary)]" },
  { mode: "Skip", weight: "excluded", color: "text-[var(--text-disabled)]" },
];

export const PENALTIES = [
  { name: "Penalized mood", multiplier: "0.5x", trigger: "Track moods contain any penalized mood" },
  {
    name: "Vocals penalty",
    multiplier: "0.5x",
    trigger: "Rubric forbids vocals and track has them",
  },
  {
    name: "Same-game adjacency",
    multiplier: "-0.05",
    trigger: "Consecutive tracks from the same game",
  },
];

export const SELECTION_PARAMS = [
  { name: "Top-N pool", value: "5", desc: "Candidates considered per slot" },
  { name: "Epsilon", value: "0.01", desc: "Added to avoid zero-weight picks" },
  { name: "Under-budget bonus", value: "+0.01/track", desc: "Bonus for under-represented games" },
  { name: "Tie-breaker noise", value: "+-0.005", desc: "Random noise to break score ties" },
  { name: "Per-game cap", value: "40%", desc: "No single game exceeds this fraction" },
];
