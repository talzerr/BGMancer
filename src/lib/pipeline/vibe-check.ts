import type { TaggedTrack, VibeScore } from "@/types";
import type { LLMProvider } from "@/lib/llm/provider";

const SYSTEM_PROMPT = `You are a music curator scoring tracks for a listening session.
Given the session context and a pool of pre-tagged game soundtrack tracks,
score each track 1-100 on how well it fits this specific session.

Score guide:
- 90-100: Perfect fit — exactly the mood/energy the listener wants
- 60-89: Good fit — works well in context
- 30-59: Neutral — could work but not ideal
- 1-29: Poor fit — clashes with the session mood

Return ONLY a JSON array: [{ "index": 1, "score": 85 }, ...]
Each index corresponds to the track number shown in the candidate pool.`;

function buildUserPrompt(
  candidates: TaggedTrack[],
  moodHint: string | null,
  recentlyPlayed: Array<{ cleanName: string; gameTitle: string }>,
): string {
  const parts: string[] = [];

  if (moodHint) {
    parts.push(`Session mood: "${moodHint}"`);
  } else {
    parts.push("Session mood: no specific mood — score based on variety and general appeal.");
  }

  if (recentlyPlayed.length > 0) {
    parts.push("\nRecently played (avoid repetition):");
    const grouped = new Map<string, string[]>();
    for (const t of recentlyPlayed) {
      const list = grouped.get(t.gameTitle) ?? [];
      list.push(t.cleanName);
      grouped.set(t.gameTitle, list);
    }
    for (const [game, tracks] of grouped) {
      parts.push(`  ${game}: ${tracks.join(", ")}`);
    }
  }

  parts.push("\nCandidate pool:");
  const grouped = new Map<string, Array<{ index: number; track: TaggedTrack }>>();
  candidates.forEach((track, i) => {
    const list = grouped.get(track.gameTitle) ?? [];
    list.push({ index: i + 1, track });
    grouped.set(track.gameTitle, list);
  });

  for (const [game, entries] of grouped) {
    parts.push(`\n=== ${game} ===`);
    for (const { index, track } of entries) {
      parts.push(`${index}. ${track.cleanName} [energy:${track.energy}, role:${track.role}]`);
    }
  }

  return parts.join("\n");
}

/**
 * Scores a candidate pool for session-specific mood fit using an LLM.
 * On parse failure, returns an empty map so the Director falls back to tag-only scoring.
 */
export async function vibeCheckPool(
  candidates: TaggedTrack[],
  moodHint: string | null,
  recentlyPlayed: Array<{ cleanName: string; gameTitle: string }>,
  provider: LLMProvider,
): Promise<Map<string, VibeScore>> {
  const userPrompt = buildUserPrompt(candidates, moodHint, recentlyPlayed);

  let raw: string;
  try {
    raw = await provider.complete(SYSTEM_PROMPT, userPrompt, {
      temperature: 0.3,
      maxTokens: 4096,
    });
  } catch (err) {
    console.error("[vibe-check] LLM call failed, falling back to tag-only scoring:", err);
    return new Map();
  }

  try {
    // Extract JSON array from response (may be wrapped in markdown code fences)
    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error("No JSON array found in response");

    const parsed = JSON.parse(jsonMatch[0]) as Array<{ index: number; score: number }>;
    const scores = new Map<string, VibeScore>();

    for (const entry of parsed) {
      const track = candidates[entry.index - 1];
      if (!track) continue;
      const fitScore = Math.max(1, Math.min(100, Math.round(entry.score)));
      scores.set(track.videoId, { fitScore });
    }

    return scores;
  } catch (err) {
    console.error("[vibe-check] Failed to parse LLM response, falling back:", err);
    return new Map();
  }
}
