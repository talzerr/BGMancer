import type { VibePreference } from "@/types";
import type { OSTTrack } from "@/lib/services/youtube";

const OLLAMA_HOST = process.env.OLLAMA_HOST ?? "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? "llama3.2";

const VIBE_CONTEXT: Record<VibePreference, string> = {
  official_soundtrack: "the most iconic and memorable tracks overall",
  boss_themes: "intense boss battle and combat themes",
  ambient_exploration: "calm, atmospheric exploration and world music",
};

/**
 * Given a real list of tracks fetched from YouTube, ask the LLM to pick
 * the N best ones matching the vibe. Returns 0-based indices into the list.
 *
 * Because the track list is grounded in real YouTube data, the LLM cannot
 * hallucinate — it can only select from what exists.
 */
export async function selectTracksFromList(
  gameTitle: string,
  vibe: VibePreference,
  tracks: OSTTrack[],
  count: number
): Promise<number[]> {
  const numbered = tracks
    .map((t, i) => `${i + 1}. ${t.title}`)
    .join("\n");

  const systemPrompt = `You are a Video Game Music Archivist with deep knowledge of game OSTs.
Your only job is to select the best tracks from a provided list — you must NOT invent or suggest tracks outside the list.
Output format: Return ONLY a valid JSON array of integers (1-indexed track numbers). No explanation, no markdown.
Example: [3, 7, 12]`;

  const userPrompt = `Game: "${gameTitle}"
Vibe: ${VIBE_CONTEXT[vibe]}

Here are the actual tracks available from the "${gameTitle}" soundtrack on YouTube:
${numbered}

Select the ${count} tracks that best represent "${VIBE_CONTEXT[vibe]}".
Only use numbers from the list above (1 to ${tracks.length}).
Return ONLY a JSON array of ${count} integers.`;

  const res = await fetch(`${OLLAMA_HOST}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      stream: false,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      options: { temperature: 0.3 },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Ollama request failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  const raw: string = data?.message?.content?.trim() ?? "[]";

  try {
    const cleaned = raw.replace(/^```json?\n?/, "").replace(/\n?```$/, "");
    const parsed: unknown[] = JSON.parse(cleaned);
    if (!Array.isArray(parsed)) throw new Error("Not an array");

    const seen = new Set<number>();
    const indices: number[] = [];
    for (const v of parsed) {
      const idx = Number(v) - 1;
      if (Number.isInteger(idx) && idx >= 0 && idx < tracks.length && !seen.has(idx)) {
        seen.add(idx);
        indices.push(idx);
        if (indices.length >= count) break;
      }
    }

    if (indices.length < count) {
      for (let i = 0; i < tracks.length && indices.length < count; i++) {
        if (!seen.has(i)) {
          seen.add(i);
          indices.push(i);
        }
      }
    }

    return indices.slice(0, count);
  } catch {
    const step = Math.max(1, Math.floor(tracks.length / count));
    return Array.from({ length: count }, (_, i) =>
      Math.min(i * step, tracks.length - 1)
    );
  }
}

/**
 * Generate compilation search queries for a full-OST game slot.
 * No LLM call — purely deterministic based on title + vibe.
 */
export function compilationQueries(
  gameTitle: string,
  vibe: VibePreference
): string[] {
  const vibeQueries: Record<VibePreference, string[]> = {
    official_soundtrack: [
      `${gameTitle} full OST official soundtrack`,
      `${gameTitle} complete official soundtrack`,
      `${gameTitle} original game soundtrack`,
    ],
    boss_themes: [
      `${gameTitle} boss battle music compilation`,
      `${gameTitle} boss themes full collection`,
      `${gameTitle} combat OST complete`,
    ],
    ambient_exploration: [
      `${gameTitle} ambient exploration music compilation`,
      `${gameTitle} exploration OST full collection`,
      `${gameTitle} world themes ambient soundtrack`,
    ],
  };
  return vibeQueries[vibe];
}
