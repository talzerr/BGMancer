import type { LLMProvider } from "./provider";
import { AnthropicProvider } from "./anthropic";

function makeAnthropicProvider(modelEnvVar: string): LLMProvider {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is required but not set");
  }
  const model = process.env[modelEnvVar] ?? process.env.ANTHROPIC_MODEL;
  return new AnthropicProvider(...(model ? [model] : []));
}

/**
 * Phase 2 provider — per-game track tagging (energy, role, cleanName, junk detection).
 *
 * Override the Anthropic model independently via:
 *   ANTHROPIC_TAGGING_MODEL=claude-haiku-4-5-20251001
 */
export function getTaggingProvider(): LLMProvider {
  return makeAnthropicProvider("ANTHROPIC_TAGGING_MODEL");
}

/**
 * Vibe Profiler provider — generates a ScoringRubric from game context.
 *
 * Override the Anthropic model independently via:
 *   ANTHROPIC_VIBE_MODEL=claude-haiku-4-5-20251001
 */
export function getVibeProfilerProvider(): LLMProvider {
  return makeAnthropicProvider("ANTHROPIC_VIBE_MODEL");
}

export type { LLMProvider } from "./provider";
