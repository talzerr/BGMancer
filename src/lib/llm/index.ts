import type { LLMProvider } from "./provider";
import { OllamaProvider } from "./ollama";
import { AnthropicProvider } from "./anthropic";
import { UserTier } from "@/types";

export { UserTier };

function makeAnthropicProvider(modelEnvVar: string): LLMProvider {
  const model = process.env[modelEnvVar] ?? process.env.ANTHROPIC_MODEL;
  return new AnthropicProvider(...(model ? [model] : []));
}

/**
 * Resolves the provider based on user tier:
 *   bard    — always Ollama (local, no API key required)
 *   maestro — Anthropic if ANTHROPIC_API_KEY is set, otherwise falls back to Ollama
 */
function providerForTier(tier: UserTier, anthropicModelEnvVar: string): LLMProvider {
  if (tier === UserTier.Maestro && process.env.ANTHROPIC_API_KEY) {
    return makeAnthropicProvider(anthropicModelEnvVar);
  }
  return getLocalLLMProvider();
}

/**
 * Phase 2 provider — per-game candidate selection.
 *
 * Override the Anthropic model independently via:
 *   ANTHROPIC_CANDIDATES_MODEL=claude-haiku-4-5-20251001
 */
export function getCandidatesProvider(tier: UserTier): LLMProvider {
  return providerForTier(tier, "ANTHROPIC_CANDIDATES_MODEL");
}

/**
 * Phase 3 provider — global cross-game curation and ordering.
 *
 * Set the Anthropic model via:
 *   ANTHROPIC_MODEL=claude-sonnet-4-5
 */
export function getCurationProvider(tier: UserTier): LLMProvider {
  return providerForTier(tier, "ANTHROPIC_MODEL");
}

/**
 * Provider for lightweight text processing (track name cleaning).
 *
 * Always uses Ollama — no game knowledge required, not worth burning API quota.
 */
export function getCleaningProvider(): LLMProvider {
  return getLocalLLMProvider();
}

/**
 * Returns a local Ollama provider.
 *
 * Configure via:
 *   OLLAMA_HOST=http://localhost:11434
 *   OLLAMA_MODEL=llama3.2
 */
export function getLocalLLMProvider(): LLMProvider {
  const ollamaHost = process.env.OLLAMA_HOST ?? "http://localhost:11434";
  const ollamaModel = process.env.OLLAMA_MODEL ?? "llama3.2";
  return new OllamaProvider(ollamaHost, ollamaModel);
}

export type { LLMProvider } from "./provider";
