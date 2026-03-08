import type { OSTTrack } from "@/lib/services/youtube";
import type { LLMProvider } from "@/lib/llm";

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function formatTrackEntry(n: number, title: string): string {
  return `${n}. ${title}`;
}

// ─── Phase 2: per-game candidate selection ────────────────────────────────────

/**
 * Given a YouTube playlist for a single game (found in Phase 1), ask the LLM
 * to pre-select N candidate tracks — filtering junk and ensuring variety within
 * the game. This candidate pool feeds Phase 3.
 *
 * The pool is shuffled before the LLM sees it so repeated runs produce
 * varied candidate sets. Returns 0-based indices into the ORIGINAL array.
 */
export async function selectTracksFromList(
  gameTitle: string,
  tracks: OSTTrack[],
  count: number,
  provider: LLMProvider,
): Promise<number[]> {
  const shuffledIndices = shuffle(Array.from({ length: tracks.length }, (_, i) => i));
  const shuffledTracks = shuffledIndices.map((i) => tracks[i]);

  const numbered = shuffledTracks.map((t, i) => formatTrackEntry(i + 1, t.title)).join("\n");

  const system = `You are a Video Game Music Curator pre-selecting quality candidates from a game's OST playlist.
You filter junk, ensure variety within the game, and return a diverse candidate pool.
Output ONLY a valid JSON array of integers (1-indexed). No markdown, no explanation. Example: [3, 7, 12]`;

  const user = `Game: "${gameTitle}"

Available tracks (${shuffledTracks.length} total, randomised order):
${numbered}

Select exactly ${count} candidates. Rules:
1. Exclude obvious junk: sound test tracks, SFX clips, very short stingers, "(Ver. 2)" duplicates of already-selected tracks.
2. Spread picks across the full soundtrack — don't cluster around one area, boss, or track type.
3. Include variety in energy and mood — avoid picking ${count} tracks of the same type (e.g. all boss themes or all ambient).
4. Keep at least one lesser-known or unexpected track alongside the obvious highlights.

Return ONLY a JSON array of exactly ${count} integers (1 to ${shuffledTracks.length}).`;

  const raw = await provider.complete(system, user, { temperature: 0.7 });

  try {
    const cleaned = raw.replace(/^```json?\n?/, "").replace(/\n?```$/, "");
    const parsed: unknown[] = JSON.parse(cleaned);
    if (!Array.isArray(parsed)) throw new Error("Not an array");

    const seen = new Set<number>();
    const originalIndices: number[] = [];

    for (const v of parsed) {
      const shuffledIdx = Number(v) - 1;
      if (
        Number.isInteger(shuffledIdx) &&
        shuffledIdx >= 0 &&
        shuffledIdx < shuffledTracks.length &&
        !seen.has(shuffledIdx)
      ) {
        seen.add(shuffledIdx);
        originalIndices.push(shuffledIndices[shuffledIdx]);
        if (originalIndices.length >= count) break;
      }
    }

    if (originalIndices.length < count) {
      const usedOriginal = new Set(originalIndices);
      for (let i = 0; i < shuffledTracks.length && originalIndices.length < count; i++) {
        const orig = shuffledIndices[i];
        if (!usedOriginal.has(orig)) {
          usedOriginal.add(orig);
          originalIndices.push(orig);
        }
      }
    }

    return originalIndices.slice(0, count);
  } catch {
    const step = Math.max(1, Math.floor(tracks.length / count));
    return Array.from({ length: count }, (_, i) => Math.min(i * step, tracks.length - 1));
  }
}

// ─── Phase 3: global cross-game curation ─────────────────────────────────────

export interface CandidateGroup {
  gameTitle: string;
  tracks: Array<{ videoId: string; title: string }>;
}

/**
 * Phase 3: global playlist curation across all games.
 *
 * Takes the candidate pools from Phase 2 (one per game) and builds a single
 * ordered playlist that balances cross-game variety, energy flow, and overall
 * arc. This is the step that makes the playlist feel intentional rather than
 * randomly assembled.
 *
 * Returns an ordered array of videoIds representing the final playlist.
 * On LLM failure, falls back to round-robin interleaving of the candidates.
 */
export async function curatePlaylist(
  groups: CandidateGroup[],
  targetCount: number,
  provider: LLMProvider,
): Promise<string[]> {
  // Build a flat numbered list, grouped by game in the prompt
  const flatTracks: Array<{ videoId: string; gameTitle: string }> = [];
  const promptLines: string[] = [];

  for (const group of groups) {
    promptLines.push(`\n=== ${group.gameTitle} ===`);
    for (const track of group.tracks) {
      const n = flatTracks.length + 1;
      flatTracks.push({ videoId: track.videoId, gameTitle: group.gameTitle });
      promptLines.push(formatTrackEntry(n, track.title));
    }
  }

  const totalCandidates = flatTracks.length;
  // Soft cap: no game dominates more than 50% when 2+ games are present
  const maxPerGame = groups.length === 1 ? targetCount : Math.ceil(targetCount * 0.5);

  const system = `You are a Video Game Music Curator assembling a listening session from multiple game soundtracks.
Your goal: select and ORDER tracks so the playlist feels intentional — varied in energy, balanced across games, with a natural arc.
Output ONLY a valid JSON array of integers (1-indexed from the combined track list). No markdown, no explanation. Example: [3, 1, 7, 12]`;

  const user = `Build a playlist of exactly ${targetCount} tracks from the ${totalCandidates} candidates below.
${promptLines.join("\n")}

Rules:
1. Select exactly ${targetCount} tracks (use the 1-indexed numbers above).
2. No single game contributes more than ${maxPerGame} tracks.
3. Return the numbers in PLAY ORDER — this IS the final sequence, not a set.
4. Avoid clustering: no more than 2 consecutive tracks from the same game.
5. Vary energy: avoid stacking 3+ intense or 3+ ambient tracks in a row.
6. Create a natural arc: open with variety, build energy mid-session, ease toward the end.

Return ONLY a JSON array of exactly ${targetCount} integers.`;

  const raw = await provider.complete(system, user, { temperature: 0.5 });

  try {
    const cleaned = raw.replace(/^```json?\n?/, "").replace(/\n?```$/, "");
    const parsed: unknown[] = JSON.parse(cleaned);
    if (!Array.isArray(parsed)) throw new Error("Not an array");

    const seen = new Set<number>();
    const result: string[] = [];

    for (const v of parsed) {
      const idx = Number(v) - 1;
      if (Number.isInteger(idx) && idx >= 0 && idx < flatTracks.length && !seen.has(idx)) {
        seen.add(idx);
        result.push(flatTracks[idx].videoId);
        if (result.length >= targetCount) break;
      }
    }

    // Pad with remaining tracks if LLM returned fewer than requested
    if (result.length < targetCount) {
      const usedIds = new Set(result);
      for (const t of flatTracks) {
        if (!usedIds.has(t.videoId)) {
          usedIds.add(t.videoId);
          result.push(t.videoId);
          if (result.length >= targetCount) break;
        }
      }
    }

    return result.slice(0, targetCount);
  } catch {
    // Fallback: round-robin interleave across games
    const result: string[] = [];
    const usedIds = new Set<string>();
    const maxLen = Math.max(...groups.map((g) => g.tracks.length));
    outer: for (let i = 0; i < maxLen; i++) {
      for (const group of groups) {
        if (i < group.tracks.length) {
          const vid = group.tracks[i].videoId;
          if (!usedIds.has(vid)) {
            usedIds.add(vid);
            result.push(vid);
            if (result.length >= targetCount) break outer;
          }
        }
      }
    }
    return result;
  }
}

// ─── Compilation search queries ───────────────────────────────────────────────

export function compilationQueries(gameTitle: string): string[] {
  return [
    `${gameTitle} full OST official soundtrack`,
    `${gameTitle} complete official soundtrack`,
    `${gameTitle} original game soundtrack`,
  ];
}
