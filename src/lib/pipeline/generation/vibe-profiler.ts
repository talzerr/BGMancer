import { createLogger } from "@/lib/logger";
import type { LLMProvider } from "@/lib/llm/provider";

const log = createLogger("vibe-profiler");
import { TrackMood, TrackInstrumentation, TrackRole } from "@/types";
import type { ScoringRubric } from "@/types";

interface ProfilerContext {
  gameTitles: string[];
  // Future expansions:
  // moodHint?: string;       — user-facing "I want something chill" input
  // recentSummary?: string;  — deterministic history summary
}

const SYSTEM_PROMPT = `You are a video game soundtrack curator. Given a list of games, produce a
ScoringRubric that describes the ideal musical atmosphere for a playlist
mixing these soundtracks.

Consider each game's known musical identity — its dominant moods,
instrumentation style, and energy level. Blend them into a cohesive rubric
that captures the shared aesthetic while respecting each game's character.

Return ONLY a JSON object with these fields:
- "targetEnergy": array of 1-3 energy levels to prefer (1=calm, 2=moderate, 3=intense)
- "preferredMoods": array of 3-5 moods from: epic, tense, peaceful, melancholic, triumphant, mysterious, playful, dark, ethereal, heroic, nostalgic, ominous, serene, chaotic, whimsical
- "penalizedMoods": array of 1-3 moods that clash with these games' aesthetics
- "preferredInstrumentation": array of 3-5 from: orchestral, synth, acoustic, chiptune, piano, rock, metal, electronic, choir, ambient, jazz, folk, strings, brass, percussion
- "penalizedInstrumentation": array of 1-3 to avoid
- "allowVocals": true, false, or null (no preference)
- "preferredRoles": array of 1-3 from: opener, ambient, build, combat, closer, menu, cinematic

Return ONLY a JSON object. No markdown fences or other text.`;

const VALID_MOODS = new Set<string>(Object.values(TrackMood));
const VALID_INSTRUMENTATION = new Set<string>(Object.values(TrackInstrumentation));
const VALID_ROLES = new Set<string>(Object.values(TrackRole));

function filterMoods(arr: unknown, max: number): TrackMood[] {
  if (!Array.isArray(arr)) return [];
  return arr.filter((v): v is TrackMood => VALID_MOODS.has(v)).slice(0, max);
}

function filterInstrumentation(arr: unknown, max: number): TrackInstrumentation[] {
  if (!Array.isArray(arr)) return [];
  return arr.filter((v): v is TrackInstrumentation => VALID_INSTRUMENTATION.has(v)).slice(0, max);
}

function filterRoles(arr: unknown, max: number): TrackRole[] {
  if (!Array.isArray(arr)) return [];
  return arr.filter((v): v is TrackRole => VALID_ROLES.has(v)).slice(0, max);
}

export async function generateRubric(
  ctx: ProfilerContext,
  provider: LLMProvider,
): Promise<ScoringRubric | null> {
  if (ctx.gameTitles.length === 0) return null;

  const userPrompt = `Games in this session: ${ctx.gameTitles.join(", ")}`;

  let raw: string;
  try {
    raw = await provider.complete(SYSTEM_PROMPT, userPrompt, {
      temperature: 0.4,
      maxTokens: 1024,
    });
  } catch (err) {
    log.error("LLM call failed", {}, err);
    return null;
  }

  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) {
    log.error("no JSON object found in response", { raw });
    return null;
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(match[0]) as Record<string, unknown>;
  } catch (err) {
    log.error("JSON parse failed", { raw: match[0] }, err);
    return null;
  }

  const targetEnergyRaw = Array.isArray(parsed.targetEnergy) ? parsed.targetEnergy : [];
  const targetEnergy = targetEnergyRaw
    .filter((v): v is 1 | 2 | 3 => v === 1 || v === 2 || v === 3)
    .slice(0, 3);

  const preferredMoods = filterMoods(parsed.preferredMoods, 5);
  if (preferredMoods.length === 0) {
    log.error("no valid preferredMoods after validation — discarding rubric");
    return null;
  }

  const penalizedMoods = filterMoods(parsed.penalizedMoods, 3);
  const preferredInstrumentation = filterInstrumentation(parsed.preferredInstrumentation, 5);
  const penalizedInstrumentation = filterInstrumentation(parsed.penalizedInstrumentation, 3);
  const preferredRoles = filterRoles(parsed.preferredRoles, 3);

  let allowVocals: boolean | null = null;
  if (parsed.allowVocals === true || parsed.allowVocals === false) {
    allowVocals = parsed.allowVocals;
  }

  return {
    targetEnergy,
    preferredMoods,
    penalizedMoods,
    preferredInstrumentation,
    penalizedInstrumentation,
    allowVocals,
    preferredRoles,
  };
}
