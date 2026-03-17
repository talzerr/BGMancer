import type { TaggedTrack, Game, ScoringRubric } from "@/types";
import { CurationMode, TrackRole, TrackMood, TrackInstrumentation } from "@/types";
import {
  SCORE_WEIGHT_ROLE,
  SCORE_WEIGHT_MOOD,
  SCORE_WEIGHT_INSTRUMENT,
  SCORE_PENALTY_MULTIPLIER,
  SCORE_VOCALS_PENALTY_MULTIPLIER,
  DIRECTOR_TOP_N_POOL,
} from "@/lib/constants";

interface ArcSlot {
  phase: string;
  energyPrefs: Array<1 | 2 | 3>;
  rolePrefs: TrackRole[];
  preferredMoods: TrackMood[];
  penalizedMoods: TrackMood[];
  preferredInstrumentation: TrackInstrumentation[];
}

const ARC_TEMPLATE: Array<{
  phase: string;
  fraction: number;
  energyPrefs: Array<1 | 2 | 3>;
  rolePrefs: TrackRole[];
  preferredMoods: TrackMood[];
  penalizedMoods: TrackMood[];
  preferredInstrumentation: TrackInstrumentation[];
}> = [
  {
    phase: "intro",
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
    phase: "rising",
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
    phase: "peak",
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
    phase: "valley",
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
    phase: "climax",
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
    phase: "outro",
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

  // Compute weights: focus=2, include=1, lite=0.5
  let totalWeight = 0;
  const weights = new Map<string, number>();
  for (const game of activeGames) {
    const w =
      game.curation === CurationMode.Focus ? 2 : game.curation === CurationMode.Lite ? 0.5 : 1;
    weights.set(game.id, w);
    totalWeight += w;
  }

  // Distribute target proportionally, capped by available pool size
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

  // Distribute remaining slots to games with available tracks
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

function scoreTrack(track: TaggedTrack, slot: ArcSlot, rubric?: ScoringRubric): number {
  // Hard gate: energy must be in slot's energy prefs
  if (!slot.energyPrefs.includes(track.energy)) return -Infinity;

  // Dimension 1: Role (intersection: any overlap with slot or rubric preferred roles → 1.0)
  const slotRoleMatch = track.roles.some((r) => slot.rolePrefs.includes(r));
  const rubricRoleMatch =
    rubric != null && track.roles.some((r) => rubric.preferredRoles.includes(r));
  const roleScore = slotRoleMatch || rubricRoleMatch ? 1.0 : 0.0;

  // Dimension 2: Mood Jaccard
  const targetMoods = rubric?.preferredMoods ?? slot.preferredMoods;
  const moodScore = jaccard(track.moods, targetMoods);

  // Dimension 3: Instrumentation Jaccard
  const targetInst = rubric?.preferredInstrumentation ?? slot.preferredInstrumentation;
  const instScore = jaccard(track.instrumentation, targetInst);

  // Weighted combination (0.0–1.0)
  let score =
    roleScore * SCORE_WEIGHT_ROLE +
    moodScore * SCORE_WEIGHT_MOOD +
    instScore * SCORE_WEIGHT_INSTRUMENT;

  // Penalty multiplier: penalized moods (arc + rubric combined)
  const allPenalized = new Set([...slot.penalizedMoods, ...(rubric?.penalizedMoods ?? [])]);
  if (track.moods.some((m) => allPenalized.has(m))) score *= SCORE_PENALTY_MULTIPLIER;

  // Vocals penalty
  if (rubric?.allowVocals === false && track.hasVocals) score *= SCORE_VOCALS_PENALTY_MULTIPLIER;

  return score;
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
): TaggedTrack[] {
  const budgets = computeGameBudgets(games, taggedPools, targetCount);
  const slots = expandArc(targetCount);

  // Shuffle pools for variety across runs
  const shuffledPools = new Map<string, TaggedTrack[]>();
  for (const [gameId, tracks] of taggedPools) {
    shuffledPools.set(gameId, shuffle(tracks));
  }

  const used = new Set<string>(); // videoId
  const gameUsed = new Map<string, number>(); // gameId → count used
  const result: TaggedTrack[] = [];
  let lastGameId: string | null = null;

  // Focus games: pre-assign slots evenly distributed across arc
  const focusGameIds = games
    .filter((g) => g.curation === CurationMode.Focus && (taggedPools.get(g.id)?.length ?? 0) > 0)
    .map((g) => g.id);

  const focusSlotIndices = new Set<number>();
  if (focusGameIds.length > 0) {
    // Distribute focus slots evenly across the arc
    for (const gameId of focusGameIds) {
      const budget = budgets.get(gameId) ?? 0;
      const pool = shuffledPools.get(gameId) ?? [];
      if (budget === 0 || pool.length === 0) continue;

      const step = Math.max(1, Math.floor(slots.length / budget));
      let placed = 0;
      for (let i = 0; i < slots.length && placed < budget; i += step) {
        // Find nearest unfilled slot
        let slotIdx = i;
        while (slotIdx < slots.length && focusSlotIndices.has(slotIdx)) slotIdx++;
        if (slotIdx >= slots.length) break;

        const track = pickBestTrack(pool, slots[slotIdx], used, gameId, lastGameId, rubric);
        if (track) {
          result[slotIdx] = track;
          focusSlotIndices.add(slotIdx);
          used.add(track.videoId);
          gameUsed.set(gameId, (gameUsed.get(gameId) ?? 0) + 1);
          lastGameId = gameId;
          placed++;
        }
      }
    }
  }

  // Fill remaining slots from include + lite pool
  // Shuffle once so fallback ordering is also randomized across runs
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

    // Try all non-focus games, prefer games under budget and not same as last
    for (const gameId of nonFocusGameIds) {
      const budget = budgets.get(gameId) ?? 0;
      const currentUsed = gameUsed.get(gameId) ?? 0;
      if (currentUsed >= budget) continue;

      const pool = shuffledPools.get(gameId) ?? [];
      const candidate = pickBestTrack(pool, slot, used, gameId, lastGameId, rubric);
      if (!candidate) continue;

      let score = scoreTrack(candidate, slot, rubric);
      // Penalize same game as previous
      if (gameId === lastGameId) score -= 0.05;
      // Bonus for under-represented games
      score += Math.max(0, budget - currentUsed) * 0.01;
      // Small random noise to break ties between equally-scored games;
      // stays below the smallest meaningful score gap
      score += Math.random() * 0.005;

      if (score > bestScore) {
        bestScore = score;
        bestTrack = candidate;
      }
    }

    // Fallback: try any game including over-budget
    if (!bestTrack) {
      const allGameIds = [...nonFocusGameIds, ...focusGameIds];
      for (const gameId of allGameIds) {
        const pool = shuffledPools.get(gameId) ?? [];
        const candidate = pickBestTrack(pool, slot, used, gameId, lastGameId, rubric);
        if (candidate) {
          bestTrack = candidate;
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
    }
  }

  // Compact (remove undefined gaps) and return
  return result.filter(Boolean);
}

function pickBestTrack(
  pool: TaggedTrack[],
  slot: ArcSlot,
  used: Set<string>,
  _gameId: string,
  lastGameId: string | null,
  rubric?: ScoringRubric,
): TaggedTrack | null {
  // Pass 1: avoid consecutive same-game
  const candidates: Array<{ track: TaggedTrack; score: number }> = [];
  for (const track of pool) {
    if (used.has(track.videoId)) continue;
    if (track.gameId === lastGameId) continue;
    const score = scoreTrack(track, slot, rubric);
    if (score > -Infinity) candidates.push({ track, score });
  }

  const picked = weightedTopN(candidates);
  if (picked) return picked;

  // Pass 2: relax same-game constraint
  const relaxed: Array<{ track: TaggedTrack; score: number }> = [];
  for (const track of pool) {
    if (used.has(track.videoId)) continue;
    const score = scoreTrack(track, slot, rubric);
    if (score > -Infinity) relaxed.push({ track, score });
  }

  return weightedTopN(relaxed);
}

function weightedTopN(
  candidates: Array<{ track: TaggedTrack; score: number }>,
): TaggedTrack | null {
  if (candidates.length === 0) return null;

  candidates.sort((a, b) => b.score - a.score);
  const pool = candidates.slice(0, DIRECTOR_TOP_N_POOL);

  // Weighted random: probability proportional to score + epsilon
  const epsilon = 0.01;
  const totalWeight = pool.reduce((sum, c) => sum + c.score + epsilon, 0);
  let rand = Math.random() * totalWeight;
  for (const c of pool) {
    rand -= c.score + epsilon;
    if (rand <= 0) return c.track;
  }

  return pool[pool.length - 1].track;
}
