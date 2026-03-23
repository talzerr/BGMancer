import type {
  TaggedTrack,
  Game,
  ScoringRubric,
  ScoreBreakdown,
  TrackDecision,
  DirectorResult,
} from "@/types";
import {
  ArcPhase,
  CurationMode,
  SelectionPass,
  TrackRole,
  TrackMood,
  TrackInstrumentation,
} from "@/types";
import {
  SCORE_WEIGHT_ROLE,
  SCORE_WEIGHT_MOOD,
  SCORE_WEIGHT_INSTRUMENT,
  SCORE_PENALTY_MULTIPLIER,
  SCORE_VOCALS_PENALTY_MULTIPLIER,
  DIRECTOR_TOP_N_POOL,
} from "@/lib/constants";

interface ArcSlot {
  phase: ArcPhase;
  energyPrefs: Array<1 | 2 | 3>;
  rolePrefs: TrackRole[];
  preferredMoods: TrackMood[];
  penalizedMoods: TrackMood[];
  preferredInstrumentation: TrackInstrumentation[];
}

const ARC_TEMPLATE: Array<{
  phase: ArcPhase;
  fraction: number;
  energyPrefs: Array<1 | 2 | 3>;
  rolePrefs: TrackRole[];
  preferredMoods: TrackMood[];
  penalizedMoods: TrackMood[];
  preferredInstrumentation: TrackInstrumentation[];
}> = [
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

function expandArc(targetCount: number): ArcSlot[] {
  const slots: ArcSlot[] = [];
  let remaining = targetCount;

  for (let i = 0; i < ARC_TEMPLATE.length; i++) {
    const template = ARC_TEMPLATE[i];
    const isLast = i === ARC_TEMPLATE.length - 1;
    const count = isLast ? remaining : Math.max(1, Math.floor(targetCount * template.fraction));
    remaining -= count;

    for (let j = 0; j < count; j++) {
      slots.push({
        phase: template.phase,
        energyPrefs: template.energyPrefs,
        rolePrefs: template.rolePrefs,
        preferredMoods: template.preferredMoods,
        penalizedMoods: template.penalizedMoods,
        preferredInstrumentation: template.preferredInstrumentation,
      });
    }
  }

  return slots;
}

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function jaccard(a: string[], b: string[]): number {
  if (a.length === 0 && b.length === 0) return 0;
  const setA = new Set(a);
  const setB = new Set(b);
  let intersection = 0;
  for (const x of setA) if (setB.has(x)) intersection++;
  const union = new Set([...setA, ...setB]).size;
  return union === 0 ? 0 : intersection / union;
}

function computeGameBudgets(
  games: Game[],
  taggedPools: Map<string, TaggedTrack[]>,
  targetCount: number,
): Map<string, number> {
  const budgets = new Map<string, number>();
  const activeGames = games.filter(
    (g) => g.curation !== CurationMode.Skip && (taggedPools.get(g.id)?.length ?? 0) > 0,
  );

  if (activeGames.length === 0) return budgets;

  let totalWeight = 0;
  const weights = new Map<string, number>();
  for (const game of activeGames) {
    const w =
      game.curation === CurationMode.Focus ? 2 : game.curation === CurationMode.Lite ? 0.5 : 1;
    weights.set(game.id, w);
    totalWeight += w;
  }

  let assigned = 0;
  for (const game of activeGames) {
    const w = weights.get(game.id) ?? 1;
    const pool = taggedPools.get(game.id) ?? [];
    const softCap = Math.ceil(targetCount * 0.4);
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

const ZERO_BREAKDOWN: ScoreBreakdown = {
  roleScore: 0,
  moodScore: 0,
  instScore: 0,
  finalScore: 0,
  adjustedScore: 0,
};

function scoreTrack(
  track: TaggedTrack,
  slot: ArcSlot,
  rubric?: ScoringRubric,
): ScoreBreakdown | null {
  if (!slot.energyPrefs.includes(track.energy)) return null;

  const slotRoleMatch = track.roles.some((r) => slot.rolePrefs.includes(r));
  const rubricRoleMatch =
    rubric != null && track.roles.some((r) => rubric.preferredRoles.includes(r));
  const roleScore = slotRoleMatch || rubricRoleMatch ? 1.0 : 0.0;

  const targetMoods = rubric?.preferredMoods ?? slot.preferredMoods;
  const moodScore = jaccard(track.moods, targetMoods);

  const targetInst = rubric?.preferredInstrumentation ?? slot.preferredInstrumentation;
  const instScore = jaccard(track.instrumentation, targetInst);

  const finalScore =
    roleScore * SCORE_WEIGHT_ROLE +
    moodScore * SCORE_WEIGHT_MOOD +
    instScore * SCORE_WEIGHT_INSTRUMENT;

  let adjustedScore = finalScore;
  const allPenalized = new Set([...slot.penalizedMoods, ...(rubric?.penalizedMoods ?? [])]);
  if (track.moods.some((m) => allPenalized.has(m))) adjustedScore *= SCORE_PENALTY_MULTIPLIER;
  if (rubric?.allowVocals === false && track.hasVocals)
    adjustedScore *= SCORE_VOCALS_PENALTY_MULTIPLIER;

  return { roleScore, moodScore, instScore, finalScore, adjustedScore };
}

interface PickResult {
  track: TaggedTrack;
  breakdown: ScoreBreakdown;
  poolSize: number;
}

/**
 * Pure TypeScript playlist assembler. Replaces the LLM-based Phase 3 curation.
 * Builds a playlist with a natural energy arc, game diversity, and respects curation modes.
 */
export function assemblePlaylist(
  taggedPools: Map<string, TaggedTrack[]>,
  games: Game[],
  targetCount: number,
  rubric?: ScoringRubric,
): DirectorResult {
  const budgets = computeGameBudgets(games, taggedPools, targetCount);
  const slots = expandArc(targetCount);

  const shuffledPools = new Map<string, TaggedTrack[]>();
  for (const [gameId, tracks] of taggedPools) {
    shuffledPools.set(gameId, shuffle(tracks));
  }

  const used = new Set<string>();
  const gameUsed = new Map<string, number>();
  const result: TaggedTrack[] = [];
  const decisions: TrackDecision[] = [];
  const hasRubric = rubric != null;
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
      finalScore: breakdown.finalScore,
      adjustedScore: breakdown.adjustedScore,
      poolSize,
      gameBudget: budgets.get(track.gameId) ?? 0,
      gameBudgetUsed: gameUsed.get(track.gameId) ?? 0,
      selectionPass,
      rubricUsed: hasRubric,
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

        const pick = pickBestTrack(pool, slots[slotIdx], used, gameId, lastGameId, rubric);
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
      .filter(
        (g) =>
          g.curation !== CurationMode.Skip &&
          g.curation !== CurationMode.Focus &&
          (taggedPools.get(g.id)?.length ?? 0) > 0,
      )
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
      const pick = pickBestTrack(pool, slot, used, gameId, lastGameId, rubric);
      if (!pick) continue;

      let score = pick.breakdown.adjustedScore;
      if (gameId === lastGameId) score -= 0.05;
      score += Math.max(0, budget - currentUsed) * 0.01;
      score += Math.random() * 0.005;

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
        const pick = pickBestTrack(pool, slot, used, gameId, lastGameId, rubric);
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
    if (!bestTrack) {
      for (const [, pool] of shuffledPools) {
        for (const track of pool) {
          if (!used.has(track.videoId)) {
            bestTrack = track;
            bestBreakdown = scoreTrack(track, slot, rubric) ?? ZERO_BREAKDOWN;
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
    console.warn(
      `[director] Pool exhausted: assembled ${compactTracks.length}/${targetCount} tracks. ` +
        `Consider adding more games or tracks.`,
    );
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

function pickBestTrack(
  pool: TaggedTrack[],
  slot: ArcSlot,
  used: Set<string>,
  _gameId: string,
  lastGameId: string | null,
  rubric?: ScoringRubric,
): PickResult | null {
  // Pass 1: avoid consecutive same-game
  const candidates: Array<{ track: TaggedTrack; breakdown: ScoreBreakdown }> = [];
  for (const track of pool) {
    if (used.has(track.videoId)) continue;
    if (track.gameId === lastGameId) continue;
    const breakdown = scoreTrack(track, slot, rubric);
    if (breakdown) candidates.push({ track, breakdown });
  }

  const picked = weightedTopN(candidates);
  if (picked) return { ...picked, poolSize: candidates.length };

  // Pass 2: relax same-game constraint
  const relaxed: Array<{ track: TaggedTrack; breakdown: ScoreBreakdown }> = [];
  for (const track of pool) {
    if (used.has(track.videoId)) continue;
    const breakdown = scoreTrack(track, slot, rubric);
    if (breakdown) relaxed.push({ track, breakdown });
  }

  const relaxedPick = weightedTopN(relaxed);
  if (relaxedPick) return { ...relaxedPick, poolSize: relaxed.length };

  return null;
}

function weightedTopN(
  candidates: Array<{ track: TaggedTrack; breakdown: ScoreBreakdown }>,
): { track: TaggedTrack; breakdown: ScoreBreakdown } | null {
  if (candidates.length === 0) return null;

  candidates.sort((a, b) => b.breakdown.adjustedScore - a.breakdown.adjustedScore);
  const pool = candidates.slice(0, DIRECTOR_TOP_N_POOL);

  const epsilon = 0.01;
  const totalWeight = pool.reduce((sum, c) => sum + c.breakdown.adjustedScore + epsilon, 0);
  let rand = Math.random() * totalWeight;
  for (const c of pool) {
    rand -= c.breakdown.adjustedScore + epsilon;
    if (rand <= 0) return c;
  }

  return pool[pool.length - 1];
}
