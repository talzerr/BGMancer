import { createLogger } from "@/lib/logger";
import type {
  TaggedTrack,
  Game,
  VibeRubric,
  ScoreBreakdown,
  TrackDecision,
  DirectorResult,
} from "@/types";
import { CurationMode, SelectionPass } from "@/types";
import type { ArcSlot, ArcTemplate } from "./types";
import {
  SCORE_WEIGHT_ROLE,
  SCORE_WEIGHT_MOOD,
  SCORE_WEIGHT_VIEW_BIAS,
  SCORE_WEIGHT_INSTRUMENT,
  VIEW_BIAS_SCORE_BASELINE,
  VIEW_BIAS_LOG_MIN,
  VIEW_BIAS_LOG_MAX,
  VIEW_BIAS_GLOBAL_HEAT_WEIGHT,
  VIEW_BIAS_LOCAL_STATURE_WEIGHT,
  VIEW_BIAS_LOCAL_STATURE_CEILING,
  SCORE_PENALTY_MULTIPLIER,
  SCORE_VOCALS_PENALTY_MULTIPLIER,
  DIRECTOR_TOP_N_POOL,
  WEIGHTED_RANDOM_EPSILON,
  SAME_GAME_PENALTY,
  DIVERSITY_BONUS_SCALE,
  SCORE_JITTER_MAX,
  BUDGET_WEIGHT_FOCUS,
  BUDGET_WEIGHT_LITE,
  BUDGET_WEIGHT_INCLUDE,
  BUDGET_SOFT_CAP_FRACTION,
} from "./constants";

// Re-export types + templates so external callers can `from ".../director"`.
export type { ArcSlot, ArcTemplate, ArcTemplatePhase } from "./types";
export {
  JOURNEY_ARC_TEMPLATE,
  CHILL_ARC_TEMPLATE,
  MIX_ARC_TEMPLATE,
  RUSH_ARC_TEMPLATE,
  getEnergyModeTemplate,
} from "./arc-templates";

const log = createLogger("director");

/** Expand an arc template into per-slot constraints. Final phase absorbs rounding remainder. */
export function expandArc(targetCount: number, template: ArcTemplate): ArcSlot[] {
  const slots: ArcSlot[] = [];
  let remaining = targetCount;

  for (let i = 0; i < template.length; i++) {
    const phase = template[i];
    const isLast = i === template.length - 1;
    const count = isLast ? remaining : Math.max(1, Math.floor(targetCount * phase.fraction));
    remaining -= count;

    for (let j = 0; j < count; j++) {
      slots.push({
        phase: phase.phase,
        energyPrefs: phase.energyPrefs,
        rolePrefs: phase.rolePrefs,
        preferredMoods: phase.preferredMoods,
        penalizedMoods: phase.penalizedMoods,
        preferredInstrumentation: phase.preferredInstrumentation,
      });
    }
  }

  return slots;
}

export function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function jaccard(a: string[], b: string[]): number {
  if (a.length === 0 && b.length === 0) return 0;
  const setA = new Set(a);
  const setB = new Set(b);
  let intersection = 0;
  for (const x of setA) if (setB.has(x)) intersection++;
  const union = new Set([...setA, ...setB]).size;
  return union === 0 ? 0 : intersection / union;
}

// ─── View Bias computation ───────────────────────────────────────────────────

export function computeGlobalHeat(viewCount: number | null): number {
  // Tracks with no view data get the baseline (0.3) rather than 0.0, to avoid penalising
  // obscure or newly-ingested games that simply haven't accumulated YouTube statistics yet.
  if (viewCount == null || viewCount <= 0) return VIEW_BIAS_SCORE_BASELINE;
  const logViews = Math.log10(viewCount);
  return Math.max(
    0,
    Math.min(1, (logViews - VIEW_BIAS_LOG_MIN) / (VIEW_BIAS_LOG_MAX - VIEW_BIAS_LOG_MIN)),
  );
}

export function computeViewBiasScores(
  taggedPools: Map<string, TaggedTrack[]>,
): Map<string, number> {
  const scores = new Map<string, number>();

  for (const [, tracks] of taggedPools) {
    const viewCounts = tracks
      .map((t) => t.viewCount)
      .filter((v): v is number => v != null && v > 0);
    const avgViews =
      viewCounts.length > 0 ? viewCounts.reduce((a, b) => a + b, 0) / viewCounts.length : 0;

    for (const track of tracks) {
      const globalHeat = computeGlobalHeat(track.viewCount);

      let localStature: number;
      if (track.viewCount == null || track.viewCount <= 0 || avgViews <= 0) {
        localStature = VIEW_BIAS_SCORE_BASELINE;
      } else {
        // ratio of 1.0 = average → 0.33; ratio of 3.0+ = 1.0
        localStature = Math.max(
          0,
          Math.min(1, track.viewCount / avgViews / VIEW_BIAS_LOCAL_STATURE_CEILING),
        );
      }

      scores.set(
        track.videoId,
        globalHeat * VIEW_BIAS_GLOBAL_HEAT_WEIGHT + localStature * VIEW_BIAS_LOCAL_STATURE_WEIGHT,
      );
    }
  }

  return scores;
}

// ─── Game budgets ────────────────────────────────────────────────────────────

export function computeGameBudgets(
  games: Game[],
  taggedPools: Map<string, TaggedTrack[]>,
  targetCount: number,
): Map<string, number> {
  const budgets = new Map<string, number>();
  const activeGames = games.filter((g) => (taggedPools.get(g.id)?.length ?? 0) > 0);

  if (activeGames.length === 0) return budgets;

  let totalWeight = 0;
  const weights = new Map<string, number>();
  for (const game of activeGames) {
    const w =
      game.curation === CurationMode.Focus
        ? BUDGET_WEIGHT_FOCUS
        : game.curation === CurationMode.Lite
          ? BUDGET_WEIGHT_LITE
          : BUDGET_WEIGHT_INCLUDE;
    weights.set(game.id, w);
    totalWeight += w;
  }

  let assigned = 0;
  for (const game of activeGames) {
    const w = weights.get(game.id) ?? 1;
    const pool = taggedPools.get(game.id) ?? [];
    const softCap = Math.ceil(targetCount * BUDGET_SOFT_CAP_FRACTION);
    const raw = Math.round((w / totalWeight) * targetCount);
    const budget = Math.min(raw, pool.length, softCap);
    budgets.set(game.id, budget);
    assigned += budget;
  }

  let leftover = targetCount - assigned;
  if (leftover > 0) {
    for (const game of activeGames) {
      if (leftover <= 0) break;
      const current = budgets.get(game.id) ?? 0;
      const pool = taggedPools.get(game.id) ?? [];
      const available = pool.length - current;
      if (available > 0) {
        const add = Math.min(available, leftover);
        budgets.set(game.id, current + add);
        leftover -= add;
      }
    }
  }

  return budgets;
}

export const ZERO_BREAKDOWN: ScoreBreakdown = {
  roleScore: 0,
  moodScore: 0,
  instScore: 0,
  viewBiasScore: 0,
  finalScore: 0,
  adjustedScore: 0,
};

export function scoreTrack(
  track: TaggedTrack,
  slot: ArcSlot,
  rubric: VibeRubric | undefined,
  viewBiasScores: Map<string, number>,
): ScoreBreakdown | null {
  if (!slot.energyPrefs.includes(track.energy)) return null;

  const phaseOverride = rubric?.phases[slot.phase];

  const slotRoleMatch = track.roles.some((r) => slot.rolePrefs.includes(r));
  const rubricRoleMatch =
    phaseOverride != null && track.roles.some((r) => phaseOverride.preferredRoles.includes(r));
  const roleScore = slotRoleMatch || rubricRoleMatch ? 1.0 : 0.0;

  const targetMoods = phaseOverride?.preferredMoods ?? slot.preferredMoods;
  const moodScore = jaccard(track.moods, targetMoods);

  const targetInst = phaseOverride?.preferredInstrumentation ?? slot.preferredInstrumentation;
  const instScore = jaccard(track.instrumentation, targetInst);

  const viewBiasScore = viewBiasScores.get(track.videoId) ?? VIEW_BIAS_SCORE_BASELINE;

  const finalScore =
    roleScore * SCORE_WEIGHT_ROLE +
    moodScore * SCORE_WEIGHT_MOOD +
    viewBiasScore * SCORE_WEIGHT_VIEW_BIAS +
    instScore * SCORE_WEIGHT_INSTRUMENT;

  let adjustedScore = finalScore;
  const allPenalized = new Set([...slot.penalizedMoods, ...(rubric?.penalizedMoods ?? [])]);
  if (track.moods.some((m) => allPenalized.has(m))) adjustedScore *= SCORE_PENALTY_MULTIPLIER;
  if (rubric?.allowVocals === false && track.hasVocals)
    adjustedScore *= SCORE_VOCALS_PENALTY_MULTIPLIER;

  return { roleScore, moodScore, instScore, viewBiasScore, finalScore, adjustedScore };
}

interface PickResult {
  track: TaggedTrack;
  breakdown: ScoreBreakdown;
  poolSize: number;
}

export interface AssembleOptions {
  /** Skip the arc-ignoring last-resort pass; shorter playlists over mismatches. Default true. */
  allowLastResort?: boolean;
}

/** Pure TypeScript playlist assembler. Deterministic given its inputs. */
export function assemblePlaylist(
  taggedPools: Map<string, TaggedTrack[]>,
  games: Game[],
  targetCount: number,
  rubric: VibeRubric | undefined,
  arcTemplate: ArcTemplate,
  options: AssembleOptions = {},
): DirectorResult {
  const allowLastResort = options.allowLastResort ?? true;
  const viewBiasScores = computeViewBiasScores(taggedPools);
  const budgets = computeGameBudgets(games, taggedPools, targetCount);
  const slots = expandArc(targetCount, arcTemplate);

  const shuffledPools = new Map<string, TaggedTrack[]>();
  for (const [gameId, tracks] of taggedPools) {
    shuffledPools.set(gameId, shuffle(tracks));
  }

  const used = new Set<string>();
  const gameUsed = new Map<string, number>();
  const result: TaggedTrack[] = [];
  const decisions: TrackDecision[] = [];
  let lastGameId: string | null = null;

  function recordDecision(
    slotIdx: number,
    track: TaggedTrack,
    breakdown: ScoreBreakdown,
    poolSize: number,
    selectionPass: SelectionPass,
  ) {
    decisions.push({
      position: slotIdx,
      arcPhase: slots[slotIdx].phase,
      gameId: track.gameId,
      trackVideoId: track.videoId,
      roleScore: breakdown.roleScore,
      moodScore: breakdown.moodScore,
      instScore: breakdown.instScore,
      viewBiasScore: breakdown.viewBiasScore,
      finalScore: breakdown.finalScore,
      adjustedScore: breakdown.adjustedScore,
      poolSize,
      gameBudget: budgets.get(track.gameId) ?? 0,
      gameBudgetUsed: gameUsed.get(track.gameId) ?? 0,
      selectionPass,
    });
  }

  // Focus games: pre-assign slots evenly distributed across arc
  const focusGameIds = games
    .filter((g) => g.curation === CurationMode.Focus && (taggedPools.get(g.id)?.length ?? 0) > 0)
    .map((g) => g.id);

  const focusSlotIndices = new Set<number>();
  if (focusGameIds.length > 0) {
    for (const gameId of focusGameIds) {
      const budget = budgets.get(gameId) ?? 0;
      const pool = shuffledPools.get(gameId) ?? [];
      if (budget === 0 || pool.length === 0) continue;

      const step = Math.max(1, Math.floor(slots.length / budget));
      let placed = 0;
      for (let i = 0; i < slots.length && placed < budget; i += step) {
        let slotIdx = i;
        while (slotIdx < slots.length && focusSlotIndices.has(slotIdx)) slotIdx++;
        if (slotIdx >= slots.length) break;

        const pick = pickBestTrack(pool, slots[slotIdx], used, rubric, viewBiasScores);
        if (pick) {
          result[slotIdx] = pick.track;
          focusSlotIndices.add(slotIdx);
          used.add(pick.track.videoId);
          gameUsed.set(gameId, (gameUsed.get(gameId) ?? 0) + 1);
          lastGameId = gameId;
          placed++;
          recordDecision(
            slotIdx,
            pick.track,
            pick.breakdown,
            pick.poolSize,
            SelectionPass.FocusPre,
          );
        }
      }
    }
  }

  // Fill remaining slots from include + lite pool
  const nonFocusGameIds = shuffle(
    games
      .filter((g) => g.curation !== CurationMode.Focus && (taggedPools.get(g.id)?.length ?? 0) > 0)
      .map((g) => g.id),
  );

  for (let i = 0; i < slots.length; i++) {
    if (focusSlotIndices.has(i)) continue;

    const slot = slots[i];
    let bestTrack: TaggedTrack | null = null;
    let bestScore = -Infinity;
    let bestBreakdown: ScoreBreakdown = ZERO_BREAKDOWN;
    let bestPoolSize = 0;
    let bestPass: SelectionPass = SelectionPass.Scored;

    // Try all non-focus games, prefer games under budget and not same as last
    for (const gameId of nonFocusGameIds) {
      const budget = budgets.get(gameId) ?? 0;
      const currentUsed = gameUsed.get(gameId) ?? 0;
      if (currentUsed >= budget) continue;

      const pool = shuffledPools.get(gameId) ?? [];
      const pick = pickBestTrack(pool, slot, used, rubric, viewBiasScores);
      if (!pick) continue;

      let score = pick.breakdown.adjustedScore;
      if (gameId === lastGameId) score -= SAME_GAME_PENALTY;
      const expectedUsed = budget * (i / slots.length);
      const deficit = (expectedUsed - currentUsed) / budget;
      score += Math.max(0, deficit) * DIVERSITY_BONUS_SCALE;
      score += Math.random() * SCORE_JITTER_MAX;

      if (score > bestScore) {
        bestScore = score;
        bestTrack = pick.track;
        bestBreakdown = { ...pick.breakdown, adjustedScore: score };
        bestPoolSize = pick.poolSize;
        bestPass = SelectionPass.Scored;
      }
    }

    // Fallback: try any game including over-budget
    if (!bestTrack) {
      const allGameIds = [...nonFocusGameIds, ...focusGameIds];
      for (const gameId of allGameIds) {
        const pool = shuffledPools.get(gameId) ?? [];
        const pick = pickBestTrack(pool, slot, used, rubric, viewBiasScores);
        if (pick) {
          bestTrack = pick.track;
          bestBreakdown = pick.breakdown;
          bestPoolSize = pick.poolSize;
          bestPass = SelectionPass.Fallback;
          break;
        }
      }
    }

    // Last resort: any unused track from any game, ignore arc
    if (!bestTrack && allowLastResort) {
      for (const [, pool] of shuffledPools) {
        for (const track of pool) {
          if (!used.has(track.videoId)) {
            bestTrack = track;
            bestBreakdown = scoreTrack(track, slot, rubric, viewBiasScores) ?? ZERO_BREAKDOWN;
            bestPoolSize = 0;
            bestPass = SelectionPass.LastResort;
            break;
          }
        }
        if (bestTrack) break;
      }
    }

    if (bestTrack) {
      result[i] = bestTrack;
      used.add(bestTrack.videoId);
      gameUsed.set(bestTrack.gameId, (gameUsed.get(bestTrack.gameId) ?? 0) + 1);
      lastGameId = bestTrack.gameId;
      recordDecision(i, bestTrack, bestBreakdown, bestPoolSize, bestPass);
    }
  }

  // Compact sparse result array and re-index decision positions to match
  const compactTracks: TaggedTrack[] = [];
  const slotToCompact = new Map<number, number>();
  for (let i = 0; i < result.length; i++) {
    if (result[i]) {
      slotToCompact.set(i, compactTracks.length);
      compactTracks.push(result[i]);
    }
  }
  const compactDecisions = decisions
    .filter((d) => slotToCompact.has(d.position))
    .map((d) => ({ ...d, position: slotToCompact.get(d.position) ?? d.position }));

  if (compactTracks.length < targetCount) {
    log.warn("pool exhausted", {
      assembled: compactTracks.length,
      target: targetCount,
    });
  }

  const gameBudgets: Record<string, number> = {};
  for (const [id, budget] of budgets) gameBudgets[id] = budget;

  return {
    tracks: compactTracks,
    decisions: compactDecisions,
    rubric,
    gameBudgets,
  };
}

export function pickBestTrack(
  pool: TaggedTrack[],
  slot: ArcSlot,
  used: Set<string>,
  rubric: VibeRubric | undefined,
  viewBiasScores: Map<string, number>,
): PickResult | null {
  const candidates: Array<{ track: TaggedTrack; breakdown: ScoreBreakdown }> = [];
  for (const track of pool) {
    if (used.has(track.videoId)) continue;
    const breakdown = scoreTrack(track, slot, rubric, viewBiasScores);
    if (breakdown) candidates.push({ track, breakdown });
  }

  const picked = weightedTopN(candidates);
  if (picked) return { ...picked, poolSize: candidates.length };

  return null;
}

export function weightedTopN(
  candidates: Array<{ track: TaggedTrack; breakdown: ScoreBreakdown }>,
): { track: TaggedTrack; breakdown: ScoreBreakdown } | null {
  if (candidates.length === 0) return null;

  candidates.sort((a, b) => b.breakdown.adjustedScore - a.breakdown.adjustedScore);
  const pool = candidates.slice(0, DIRECTOR_TOP_N_POOL);

  const totalWeight = pool.reduce(
    (sum, c) => sum + c.breakdown.adjustedScore + WEIGHTED_RANDOM_EPSILON,
    0,
  );
  let rand = Math.random() * totalWeight;
  let picked = pool[0];
  for (const c of pool) {
    rand -= c.breakdown.adjustedScore + WEIGHTED_RANDOM_EPSILON;
    picked = c;
    if (rand <= 0) break;
  }
  return picked;
}
