import { createLogger } from "@/lib/logger";
import type { LLMProvider } from "@/lib/llm/provider";

const log = createLogger("vibe-profiler");
import { ArcPhase, TrackMood, TrackInstrumentation, TrackRole } from "@/types";
import type { VibeRubric, PhaseOverride } from "@/types";
import { SESSION_NAME_MAX_LENGTH } from "@/lib/constants";
import { Sessions } from "@/lib/db/repo";

export interface ProfilerResult {
  rubric: VibeRubric;
  sessionName: string | null;
}

export interface GameProfile {
  title: string;
  trackCount: number;
  energy: Record<string, number>;
  moods: Record<string, number>;
  instrumentation: Record<string, number>;
}

interface ProfilerContext {
  gameProfiles: GameProfile[];
  // Future expansions:
  // moodHint?: string;       — user-facing "I want something chill" input
  // recentSummary?: string;  — deterministic history summary
}

const VALID_MOODS = new Set<string>(Object.values(TrackMood));
const VALID_INSTRUMENTATION = new Set<string>(Object.values(TrackInstrumentation));
const VALID_ROLES = new Set<string>(Object.values(TrackRole));

const SYSTEM_PROMPT = `You are a video game soundtrack curator. You will receive a list of games with their actual track tag data — energy distribution, mood frequencies, and instrument frequencies. Your job is to modify a playlist arc template so that each phase is tailored to these specific games.

Base your decisions on the tag data provided, not on general knowledge of the games. The data tells you what these soundtracks actually sound like.

Below is the default arc template. Each phase has a purpose, default preferred moods, preferred instrumentation, and preferred track roles. Your job is to NARROW each phase's preferences to fit these games — not to broaden them. The arc already provides good defaults. You are re-selecting the best 2 moods and 2 instruments for each phase from the full valid values list. You are not limited to subsetting the phase defaults — you may introduce moods or instruments not in the defaults if they better represent these games.

## Default Arc Template

### intro (15% of playlist — calm opening)
- preferredMoods: peaceful, mysterious, nostalgic
- preferredInstrumentation: piano, ambient, strings
- rolePrefs: opener, menu, ambient

### rising (25% — building tension)
- preferredMoods: mysterious, tense, melancholic
- preferredInstrumentation: orchestral, strings, synth
- rolePrefs: build, ambient, cinematic

### peak (25% — high energy action)
- preferredMoods: epic, tense, heroic
- preferredInstrumentation: orchestral, rock, metal
- rolePrefs: combat, build, cinematic

### valley (15% — mid-playlist breather)
- preferredMoods: peaceful, serene, melancholic
- preferredInstrumentation: ambient, piano, acoustic
- rolePrefs: ambient, cinematic

### climax (10% — maximum intensity)
- preferredMoods: epic, heroic, triumphant, chaotic
- preferredInstrumentation: orchestral, metal, choir
- rolePrefs: combat, cinematic

### outro (10% — reflective close)
- preferredMoods: melancholic, nostalgic, peaceful
- preferredInstrumentation: piano, acoustic, strings
- rolePrefs: closer, ambient, menu

## Valid values

Moods: epic, tense, peaceful, melancholic, triumphant, mysterious, playful, dark, ethereal, heroic, nostalgic, ominous, serene, chaotic, whimsical
Instrumentation: orchestral, synth, acoustic, chiptune, piano, rock, metal, electronic, choir, ambient, jazz, folk, strings, brass, percussion
Roles: opener, ambient, build, combat, closer, menu, cinematic

## Output format

Return ONLY a JSON object with this structure:
{
  "phases": {
    "intro": {
      "preferredMoods": ["mood1", "mood2"],
      "preferredInstrumentation": ["inst1", "inst2"],
      "preferredRoles": ["role1"]
    },
    "rising": { ... },
    "peak": { ... },
    "valley": { ... },
    "climax": { ... },
    "outro": { ... }
  },
  "penalizedMoods": ["mood1", "mood2"],
  "allowVocals": false,
  "sessionName": "Short Evocative Title"
}

## Rules

Per-phase fields:
- preferredMoods: exactly 2 moods. Pick the 2 that best fit these games AND this phase's purpose. Fewer = sharper filtering = better playlist. The intro should still feel like an intro, but for THESE games.
- preferredInstrumentation: exactly 2. Same principle.
- preferredRoles: 0-2 roles. Only include if these games strongly favor specific roles for this phase. Empty array is fine.

Global fields:
- penalizedMoods: 2-3 moods that universally clash with these games' aesthetics.
- allowVocals: true if vocals fit, false if instrumental-only is better, null if no preference.
- sessionName: a 2-4 word evocative playlist title capturing the mood of this game combination. No exclamation marks, no first-person, no marketing language. Examples: "Soulsborne Descent", "Pixel Nostalgia", "Moonlit Kingdoms", "Neon Underground".

## Example

For Dark Souls + Hollow Knight:
- intro shifts from [peaceful, mysterious, nostalgic] to [dark, mysterious] — still quiet and exploratory, but colored by these games' identity
- peak shifts from [epic, tense, heroic] to [dark, ominous] — intense, but with a sense of dread rather than triumph
- outro shifts from [melancholic, nostalgic, peaceful] to [melancholic, ethereal] — the reflective close keeps its emotional weight but trades warmth for the hollow stillness these games are known for

Notice that "dark" and "ethereal" are not in the phase defaults — they're pulled from the full valid values list because they better represent these games.

Return ONLY a JSON object. No markdown fences or other text.`;

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

function parsePhaseOverride(raw: unknown): PhaseOverride | null {
  if (raw == null || typeof raw !== "object") return null;
  const phase = raw as Record<string, unknown>;
  const moods = filterMoods(phase.preferredMoods, 2);
  if (moods.length === 0) return null;
  const instrumentation = filterInstrumentation(phase.preferredInstrumentation, 2);
  if (instrumentation.length === 0) return null;
  const roles = filterRoles(phase.preferredRoles, 2);
  return {
    preferredMoods: moods,
    preferredInstrumentation: instrumentation,
    preferredRoles: roles,
  };
}

function formatFrequencies(freqs: Record<string, number>): string {
  return Object.entries(freqs)
    .sort((a, b) => b[1] - a[1])
    .map(([key, count]) => `${key}(${count})`)
    .join(", ");
}

function formatUserPrompt(profiles: GameProfile[]): string {
  const sections = profiles.map((g) => {
    const lines = [`### ${g.title} (${g.trackCount} tracks)`];
    lines.push(`Energy: ${formatFrequencies(g.energy)}`);
    lines.push(`Moods: ${formatFrequencies(g.moods)}`);
    lines.push(`Instrumentation: ${formatFrequencies(g.instrumentation)}`);
    return lines.join("\n");
  });
  return sections.join("\n\n");
}

export function buildGameProfiles(
  games: Array<{ id: string; title: string }>,
  taggedPools: Map<
    string,
    Array<{ energy: 1 | 2 | 3; moods: string[]; instrumentation: string[] }>
  >,
): GameProfile[] {
  return games
    .filter((g) => taggedPools.has(g.id))
    .map((game) => {
      const tracks = taggedPools.get(game.id) ?? [];
      const energy: Record<string, number> = {};
      const moods: Record<string, number> = {};
      const instrumentation: Record<string, number> = {};

      for (const track of tracks) {
        const eKey = String(track.energy);
        energy[eKey] = (energy[eKey] ?? 0) + 1;
        for (const m of track.moods) moods[m] = (moods[m] ?? 0) + 1;
        for (const i of track.instrumentation) instrumentation[i] = (instrumentation[i] ?? 0) + 1;
      }

      return { title: game.title, trackCount: tracks.length, energy, moods, instrumentation };
    });
}

export async function generateRubric(
  ctx: ProfilerContext,
  provider: LLMProvider,
): Promise<ProfilerResult | null> {
  if (ctx.gameProfiles.length === 0) return null;

  const userPrompt = formatUserPrompt(ctx.gameProfiles);

  let raw: string;
  try {
    raw = await provider.complete(SYSTEM_PROMPT, userPrompt, {
      temperature: 0.4,
      maxTokens: 1024,
      cacheSystem: true,
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

  // Parse per-phase overrides
  const phases: Partial<Record<ArcPhase, PhaseOverride>> = {};
  const rawPhases = parsed.phases;
  if (rawPhases != null && typeof rawPhases === "object") {
    const phaseMap = rawPhases as Record<string, unknown>;
    for (const phase of Object.values(ArcPhase)) {
      const override = parsePhaseOverride(phaseMap[phase]);
      if (override) phases[phase] = override;
    }
  }

  if (Object.keys(phases).length === 0) {
    log.error("no valid phase overrides after validation — discarding rubric");
    return null;
  }

  // Global fields
  const penalizedMoods = filterMoods(parsed.penalizedMoods, 3);

  let allowVocals: boolean | null = null;
  if (parsed.allowVocals === true || parsed.allowVocals === false) {
    allowVocals = parsed.allowVocals;
  }

  const rawName = parsed.sessionName;
  const sessionName =
    typeof rawName === "string" &&
    rawName.trim().length > 0 &&
    rawName.length <= SESSION_NAME_MAX_LENGTH
      ? rawName.trim()
      : null;

  return {
    rubric: { phases, penalizedMoods, allowVocals },
    sessionName,
  };
}

/**
 * Checks the user's existing sessions for one with a matching game set and returns
 * its stored rubric + name. Game sets are compared as unordered sets of game IDs.
 * Returns null if no session matches or if no cached session has valid telemetry.
 *
 * Sessions are FIFO-capped at MAX_PLAYLIST_SESSIONS (3), so this is bounded.
 */
export async function findCachedRubric(
  userId: string,
  activeGameIds: string[],
): Promise<ProfilerResult | null> {
  const sessions = await Sessions.listAllWithCounts(userId);
  if (sessions.length === 0) return null;

  const targetSize = activeGameIds.length;
  const targetSet = new Set(activeGameIds);

  for (const session of sessions) {
    const telemetry = await Sessions.getByIdWithTelemetry(session.id);
    if (!telemetry?.rubric || !telemetry.gameBudgets) continue;

    const cachedIds = Object.keys(telemetry.gameBudgets);
    if (cachedIds.length !== targetSize) continue;
    if (!cachedIds.every((id) => targetSet.has(id))) continue;

    return { rubric: telemetry.rubric, sessionName: telemetry.name };
  }

  return null;
}
