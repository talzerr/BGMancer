import type { LLMProvider } from "./provider";
import { AnthropicProvider } from "./anthropic";
import { env } from "@/lib/env";

function makeAnthropicProvider(modelOverride: string | undefined): LLMProvider {
  if (!env.anthropicApiKey) {
    throw new Error("ANTHROPIC_API_KEY is required but not set");
  }
  const model = modelOverride ?? env.anthropicModel;
  return new AnthropicProvider(...(model ? [model] : []));
}

/**
 * Phase 2 provider — per-game track tagging (energy, role, cleanName, junk detection).
 *
 * Override the Anthropic model independently via:
 *   ANTHROPIC_TAGGING_MODEL=claude-haiku-4-5-20251001
 */
export function getTaggingProvider(): LLMProvider {
  return makeAnthropicProvider(env.anthropicTaggingModel);
}

/**
 * Vibe Profiler provider — generates a ScoringRubric from game context.
 *
 * Override the Anthropic model independently via:
 *   ANTHROPIC_VIBE_MODEL=claude-haiku-4-5-20251001
 */
export function getVibeProfilerProvider(): LLMProvider {
  return makeAnthropicProvider(env.anthropicVibeModel);
}

export type { LLMProvider } from "./provider";
