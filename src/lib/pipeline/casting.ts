import type { TaggedTrack, Game } from "@/types";
import { CurationMode } from "@/types";
import { CASTING_POOL_MULTIPLIER } from "@/lib/constants";

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Builds a candidate pool from tagged tracks for the Vibe Check LLM to score.
 * Allocates ~2.5× targetCount total candidates across games, weighted by curation mode.
 */
export function buildCandidatePool(
  taggedPools: Map<string, TaggedTrack[]>,
  games: Game[],
  targetCount: number,
): TaggedTrack[] {
  const poolTarget = Math.ceil(targetCount * CASTING_POOL_MULTIPLIER);

  const activeGames = games.filter(
    (g) => g.curation !== CurationMode.Skip && (taggedPools.get(g.id)?.length ?? 0) > 0,
  );

  if (activeGames.length === 0) return [];

  // Compute weights: focus=2, include=1, lite=0.5
  let totalWeight = 0;
  const weights = new Map<string, number>();
  for (const game of activeGames) {
    const w =
      game.curation === CurationMode.Focus ? 2 : game.curation === CurationMode.Lite ? 0.5 : 1;
    weights.set(game.id, w);
    totalWeight += w;
  }

  const candidates: TaggedTrack[] = [];

  for (const game of activeGames) {
    const w = weights.get(game.id) ?? 1;
    const pool = taggedPools.get(game.id) ?? [];
    const allocation = Math.min(Math.ceil((w / totalWeight) * poolTarget), pool.length);
    const picked = shuffle(pool).slice(0, allocation);
    candidates.push(...picked);
  }

  return candidates;
}
