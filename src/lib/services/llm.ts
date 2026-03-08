import type { VibePreference } from "@/types";
import type { OSTTrack } from "@/lib/services/youtube";

const OLLAMA_HOST = process.env.OLLAMA_HOST ?? "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? "llama3.2";

const VIBE_CONTEXT: Record<VibePreference, string> = {
  official_soundtrack:
    "iconic and memorable highlights — the tracks fans remember most. A greatest-hits feel with varied energy, suitable for general listening.",
  boss_themes:
    "intense, high-tension combat and boss battle music — dramatic, powerful, relentless. Prefer tracks with strong momentum and a sense of danger or triumph.",
  ambient_exploration:
    "calm, atmospheric world music and exploration themes — peaceful, spacious, non-intrusive. Avoid anything dramatic, loud, or combat-oriented.",
  study_focus:
    "steady, non-distracting instrumental background music — calm and consistent energy with no sudden loud moments, dramatic builds, or jarring transitions. Ideal for sustained concentration, coding, reading, or quiet work.",
  workout_hype:
    "high-energy, driving tracks with strong rhythm and forward momentum — fast-paced, intense, relentless. Prefer music that builds urgency and keeps you moving. Ideal for running, training, or getting pumped up.",
  emotional_story:
    "emotionally resonant tracks tied to key story and character moments — cinematic, moving, bittersweet, or nostalgic. Prefer music that feels meaningful and would fit a memorable cutscene or ending.",
};

/**
 * Fisher-Yates shuffle — returns a new shuffled array without mutating the original.
 */
function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Given a real list of tracks fetched from YouTube, ask the LLM to pick
 * the N best ones matching the vibe. Returns 0-based indices into the
 * ORIGINAL (unshuffled) tracks array.
 *
 * The pool is shuffled before the LLM sees it so repeated generations
 * produce varied selections even for the same game.
 */
export async function selectTracksFromList(
  gameTitle: string,
  vibe: VibePreference,
  tracks: OSTTrack[],
  count: number,
): Promise<number[]> {
  // Shuffle so the LLM sees tracks in a different order each time.
  // We keep a mapping back to original indices.
  const shuffledIndices = shuffle(Array.from({ length: tracks.length }, (_, i) => i));
  const shuffledTracks = shuffledIndices.map((i) => tracks[i]);

  const numbered = shuffledTracks.map((t, i) => `${i + 1}. ${t.title}`).join("\n");

  const systemPrompt = `You are a Video Game Music Curator who builds emotionally cohesive playlists for specific listening contexts.
You select tracks from a real provided list — you must NEVER invent or suggest tracks outside the list.
When selecting, reason about each track's likely energy and mood from its title, then apply the listening context.
Output format: Return ONLY a valid JSON array of integers (1-indexed). No explanation, no markdown, no extra text.
Example: [3, 7, 12]`;

  const userPrompt = `Game: "${gameTitle}"
Listening context: ${VIBE_CONTEXT[vibe]}

Available tracks (randomised order — not in game progression):
${numbered}

Select exactly ${count} tracks. Follow these rules:
1. All picks must match the listening context above — reject tracks whose titles suggest a different energy or mood.
2. Spread picks across different parts of the soundtrack (don't cluster from the same game area or boss).
3. Include variety in energy within the context — e.g. don't pick ${count} tracks that all sound identical.
4. Favour at least one lesser-known or unexpected track alongside the obvious highlights.

Return ONLY a JSON array of exactly ${count} integers (1 to ${shuffledTracks.length}).`;

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
      options: { temperature: 0.7 },
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

    // Pad with unseen tracks if LLM returned fewer than requested
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
    // Fallback: evenly spaced from original array
    const step = Math.max(1, Math.floor(tracks.length / count));
    return Array.from({ length: count }, (_, i) => Math.min(i * step, tracks.length - 1));
  }
}

/**
 * Generate compilation search queries for a full-OST game slot.
 * No LLM call — purely deterministic based on title + vibe.
 */
export function compilationQueries(gameTitle: string, vibe: VibePreference): string[] {
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
    study_focus: [
      `${gameTitle} calm music full collection`,
      `${gameTitle} relaxing OST complete`,
      `${gameTitle} peaceful soundtrack compilation`,
    ],
    workout_hype: [
      `${gameTitle} intense music full collection`,
      `${gameTitle} high energy OST complete`,
      `${gameTitle} action themes compilation`,
    ],
    emotional_story: [
      `${gameTitle} emotional music full collection`,
      `${gameTitle} story OST complete`,
      `${gameTitle} cinematic soundtrack compilation`,
    ],
  };
  return vibeQueries[vibe];
}
