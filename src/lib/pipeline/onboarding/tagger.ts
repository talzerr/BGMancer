import { createLogger } from "@/lib/logger";
import type { Track } from "@/types";

const log = createLogger("tagger");
import {
  DiscoveredStatus,
  ReviewReason,
  TrackRole,
  TrackMood,
  TrackInstrumentation,
} from "@/types";
import type { LLMProvider } from "@/lib/llm/provider";
import { Tracks, ReviewFlags } from "@/lib/db/repo";
import { TAG_BATCH_SIZE, TAG_POOL_MAX } from "@/lib/constants";

const VALID_ROLES = new Set<string>(Object.values(TrackRole));
const VALID_MOODS = new Set<string>(Object.values(TrackMood));
const VALID_INSTRUMENTATION = new Set<string>(Object.values(TrackInstrumentation));

const SYSTEM_PROMPT = `You are a music metadata classifier for a game soundtrack tagging system.
Given a game title and a list of its soundtrack tracks, return a JSON array with one entry per track.

Each entry must have:
- "index": the track number (1-based, matching the input list)
- "energy": 1 (calm/ambient/background), 2 (moderate/building), or 3 (high-intensity/combat/climactic)
- "roles": array of 1-2 values from: opener, ambient, build, combat, closer, menu, cinematic
- "moods": array of up to 3 values from: epic, tense, peaceful, melancholic, triumphant, mysterious, playful, dark, ethereal, heroic, nostalgic, ominous, serene, chaotic, whimsical
- "instrumentation": array of up to 3 values from: orchestral, synth, acoustic, chiptune, piano, rock, metal, electronic, choir, ambient, jazz, folk, strings, brass, percussion. Tag the DOMINANT instruments — if a track is primarily piano with faint strings, tag "piano", not "orchestral".
- "hasVocals": true if the track has significant sung vocals, false otherwise
- "confident": false if you are inferring tags solely from the track title without specific knowledge of the track's arrangement or composition, true if you recognize the actual piece

Example output for a single track:
[{"index":1,"energy":3,"roles":["opener","cinematic"],"moods":["epic","heroic"],"instrumentation":["orchestral","choir","brass"],"hasVocals":true,"confident":true}]

Return ONLY a valid JSON array. No markdown fences, no preamble, no commentary.`;

export interface LLMTagItem {
  index: number;
  energy: number;
  roles: unknown[];
  moods: unknown[];
  instrumentation: unknown[];
  hasVocals: unknown;
  confident: unknown;
}

export interface ParsedTag {
  energy: 1 | 2 | 3;
  roles: TrackRole[];
  moods: TrackMood[];
  instrumentation: TrackInstrumentation[];
  hasVocals: boolean;
  confident: boolean;
}

/** Extract a JSON array of tag items from raw LLM output */
export function extractTagArray(raw: string): LLMTagItem[] {
  const jsonMatch = raw.match(/\[[\s\S]*\]/);
  if (!jsonMatch) throw new Error("No JSON array found in response");
  return JSON.parse(jsonMatch[0]) as LLMTagItem[];
}

/** Validate and normalize a single LLM tag item. Returns null if energy or roles are invalid. */
export function parseTagItem(item: LLMTagItem): ParsedTag | null {
  const energy = item.energy;
  if (energy !== 1 && energy !== 2 && energy !== 3) return null;

  const roles = Array.isArray(item.roles)
    ? (item.roles as unknown[])
        .filter((r): r is string => typeof r === "string" && VALID_ROLES.has(r.toLowerCase()))
        .map((r) => r.toLowerCase() as TrackRole)
        .slice(0, 2)
    : [];
  if (roles.length === 0) return null;

  const moods = Array.isArray(item.moods)
    ? (item.moods as unknown[])
        .filter((m): m is string => typeof m === "string" && VALID_MOODS.has(m.toLowerCase()))
        .map((m) => m.toLowerCase() as TrackMood)
        .slice(0, 3)
    : [];

  const instrumentation = Array.isArray(item.instrumentation)
    ? (item.instrumentation as unknown[])
        .filter(
          (v): v is string => typeof v === "string" && VALID_INSTRUMENTATION.has(v.toLowerCase()),
        )
        .map((v) => v.toLowerCase() as TrackInstrumentation)
        .slice(0, 3)
    : [];

  const hasVocals = item.hasVocals === true;
  const confident = item.confident !== false;

  return { energy, roles, moods, instrumentation, hasVocals, confident };
}

export async function tagTracks(
  gameId: string,
  gameTitle: string,
  tracks: Track[],
  provider: LLMProvider,
  signal?: AbortSignal,
  onProgress?: (current: number, total: number, trackName: string) => void,
): Promise<void> {
  const allUntagged = tracks.filter(
    (t) =>
      t.taggedAt === null && (t.discovered === null || t.discovered === DiscoveredStatus.Approved),
  );
  if (allUntagged.length === 0) return;

  if (allUntagged.length > TAG_POOL_MAX) {
    await ReviewFlags.markAsNeedsReview(
      gameId,
      ReviewReason.TrackCapReached,
      `${allUntagged.length - TAG_POOL_MAX} tracks will remain untagged (${allUntagged.length} untagged, cap is ${TAG_POOL_MAX})`,
    );
  }

  const untagged = allUntagged.slice(0, TAG_POOL_MAX);

  for (let i = 0; i < untagged.length; i += TAG_BATCH_SIZE) {
    if (signal?.aborted) throw new Error("Cancelled");

    const batch = untagged.slice(i, i + TAG_BATCH_SIZE);
    onProgress?.(i, untagged.length, batch[0].name);
    const batchNum = i / TAG_BATCH_SIZE + 1;
    const userPrompt = buildUserPrompt(gameTitle, batch);

    let raw: string;
    try {
      raw = await provider.complete(SYSTEM_PROMPT, userPrompt, {
        temperature: 0.2,
        maxTokens: 4096,
        signal,
      });
    } catch (err) {
      // Re-throw abort errors — don't flag cancellations as failures
      if (signal?.aborted) throw err;
      log.error("LLM call failed", { gameTitle, batch: batchNum }, err);
      await ReviewFlags.markAsNeedsReview(
        gameId,
        ReviewReason.LlmCallFailed,
        `batch ${batchNum}: ${String(err)}`,
      );
      continue;
    }

    let parsed: LLMTagItem[];
    try {
      parsed = extractTagArray(raw);
    } catch (err) {
      log.error("failed to parse LLM response", { gameTitle, batch: batchNum }, err);
      await ReviewFlags.markAsNeedsReview(
        gameId,
        ReviewReason.LlmParseFailed,
        `batch ${batchNum}: ${String(err)}`,
      );
      continue;
    }

    for (const item of parsed) {
      const track = batch[item.index - 1];
      if (!track) continue;

      const tag = parseTagItem(item);
      if (!tag) {
        const reason =
          item.energy !== 1 && item.energy !== 2 && item.energy !== 3
            ? `invalid energy for "${track.name}": ${JSON.stringify(item.energy)}`
            : `invalid roles for "${track.name}": ${JSON.stringify(item.roles)}`;
        await ReviewFlags.markAsNeedsReview(gameId, ReviewReason.EmptyMetadata, reason);
        continue;
      }

      if (!tag.confident) {
        await ReviewFlags.markAsNeedsReview(gameId, ReviewReason.LowConfidence, track.name);
      }

      await Tracks.updateTags(gameId, track.name, {
        energy: tag.energy,
        roles: JSON.stringify(tag.roles),
        moods: JSON.stringify(tag.moods),
        instrumentation: JSON.stringify(tag.instrumentation),
        hasVocals: tag.hasVocals,
      });
    }
  }
}

function buildUserPrompt(gameTitle: string, batch: Track[]): string {
  const lines = batch.map((t, i) => `${i + 1}. ${t.name}`).join("\n");
  return `Game: ${gameTitle}\n\nTracks:\n${lines}`;
}
