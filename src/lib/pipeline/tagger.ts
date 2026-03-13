import type { Track, TrackRole, TrackMood, TrackInstrumentation } from "@/types";
import type { LLMProvider } from "@/lib/llm/provider";
import { Tracks, Games } from "@/lib/db/repo";
import { TAG_BATCH_SIZE, TAG_POOL_MAX } from "@/lib/constants";

const VALID_ROLES = new Set<string>([
  "opener",
  "ambient",
  "build",
  "combat",
  "closer",
  "menu",
  "cinematic",
]);
const VALID_MOODS = new Set<string>([
  "epic",
  "tense",
  "peaceful",
  "melancholic",
  "triumphant",
  "mysterious",
  "playful",
  "dark",
  "ethereal",
  "heroic",
  "nostalgic",
  "ominous",
  "serene",
  "chaotic",
  "whimsical",
]);
const VALID_INSTRUMENTATION = new Set<string>([
  "orchestral",
  "synth",
  "acoustic",
  "chiptune",
  "piano",
  "rock",
  "metal",
  "electronic",
  "choir",
  "ambient",
  "jazz",
  "folk",
  "strings",
  "brass",
  "percussion",
]);

const SYSTEM_PROMPT = `You are a music metadata classifier for a game soundtrack tagging system.
Given a list of game soundtrack tracks, return a JSON array with one entry per track.

Each entry must have:
- "index": the track number (1-based, matching the input list)
- "energy": 1 (calm/ambient/background), 2 (moderate/building), or 3 (high-intensity/combat/climactic)
- "role": one of: opener, ambient, build, combat, closer, menu, cinematic
- "moods": array of up to 3 values from: epic, tense, peaceful, melancholic, triumphant, mysterious, playful, dark, ethereal, heroic, nostalgic, ominous, serene, chaotic, whimsical
- "instrumentation": array of up to 3 values from: orchestral, synth, acoustic, chiptune, piano, rock, metal, electronic, choir, ambient, jazz, folk, strings, brass, percussion
- "hasVocals": true if the track has significant sung vocals, false otherwise
- "confident": false if you are uncertain about the classification (e.g. unfamiliar track name), true otherwise

Return ONLY a JSON array. Do not include markdown fences or any other text.`;

interface LLMTagItem {
  index: number;
  energy: number;
  role: string;
  moods: unknown[];
  instrumentation: unknown[];
  hasVocals: unknown;
  confident: unknown;
}

export async function tagTracks(
  gameId: string,
  gameTitle: string,
  tracks: Track[],
  provider: LLMProvider,
): Promise<void> {
  const untagged = tracks.filter((t) => t.taggedAt === null).slice(0, TAG_POOL_MAX);
  if (untagged.length === 0) return;

  let needsReview = false;

  for (let i = 0; i < untagged.length; i += TAG_BATCH_SIZE) {
    const batch = untagged.slice(i, i + TAG_BATCH_SIZE);
    const userPrompt = buildUserPrompt(gameTitle, batch);

    let raw: string;
    try {
      raw = await provider.complete(SYSTEM_PROMPT, userPrompt, {
        temperature: 0.2,
        maxTokens: 4096,
      });
    } catch (err) {
      console.error(
        `[tagger] LLM call failed for game "${gameTitle}" batch ${i / TAG_BATCH_SIZE + 1}:`,
        err,
      );
      needsReview = true;
      continue;
    }

    let parsed: LLMTagItem[];
    try {
      const jsonMatch = raw.match(/\[[\s\S]*\]/);
      if (!jsonMatch) throw new Error("No JSON array found in response");
      parsed = JSON.parse(jsonMatch[0]) as LLMTagItem[];
    } catch (err) {
      console.error(
        `[tagger] Failed to parse LLM response for game "${gameTitle}" batch ${i / TAG_BATCH_SIZE + 1}:`,
        err,
      );
      needsReview = true;
      continue;
    }

    for (const item of parsed) {
      const track = batch[item.index - 1];
      if (!track) continue;

      const energy = item.energy;
      if (energy !== 1 && energy !== 2 && energy !== 3) continue;

      const role = typeof item.role === "string" ? item.role.toLowerCase() : "";
      if (!VALID_ROLES.has(role)) continue;

      const moods = Array.isArray(item.moods)
        ? (item.moods as unknown[])
            .filter((m): m is string => typeof m === "string" && VALID_MOODS.has(m.toLowerCase()))
            .map((m) => m.toLowerCase() as TrackMood)
            .slice(0, 3)
        : [];

      const instrumentation = Array.isArray(item.instrumentation)
        ? (item.instrumentation as unknown[])
            .filter(
              (v): v is string =>
                typeof v === "string" && VALID_INSTRUMENTATION.has(v.toLowerCase()),
            )
            .map((v) => v.toLowerCase() as TrackInstrumentation)
            .slice(0, 3)
        : [];

      const hasVocals = item.hasVocals === true;
      const confident = item.confident !== false;

      if (!confident) needsReview = true;

      Tracks.updateTags(gameId, track.name, {
        energy,
        role: role as TrackRole,
        moods: JSON.stringify(moods),
        instrumentation: JSON.stringify(instrumentation),
        hasVocals,
      });
    }
  }

  if (needsReview) {
    Games.update(gameId, { needs_review: true });
  }
}

function buildUserPrompt(gameTitle: string, batch: Track[]): string {
  const lines = batch.map((t, i) => `${i + 1}. ${t.name}`).join("\n");
  return `Game: ${gameTitle}\n\nTracks:\n${lines}`;
}
