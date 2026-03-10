import type { LLMProvider } from "./provider";
import { OllamaProvider } from "./ollama";
import { AnthropicProvider } from "./anthropic";

function makeAnthropicProvider(modelEnvVar: string): LLMProvider {
  const model = process.env[modelEnvVar] ?? process.env.ANTHROPIC_MODEL;
  return new AnthropicProvider(...(model ? [model] : []));
}

/**
 * Phase 2 provider — per-game candidate selection.
 *
 * Game knowledge matters here (knowing what makes a soundtrack stand out),
 * so we prefer Claude when available. Falls back to local (Ollama) if no key.
 *
 * Override the model independently of the curation model via:
 *   ANTHROPIC_CANDIDATES_MODEL=claude-haiku-4-5-20251001
 */
export function getCandidatesProvider(): LLMProvider {
  if (process.env.ANTHROPIC_API_KEY) return makeAnthropicProvider("ANTHROPIC_CANDIDATES_MODEL");
  return getLocalLLMProvider();
}

/**
 * Phase 3 provider — global cross-game curation and ordering.
 *
 * Requires strong game and music knowledge to build a coherent playlist arc.
 * Falls back to local (Ollama) if no key.
 *
 * Set the model via:
 *   ANTHROPIC_MODEL=claude-sonnet-4-5
 */
export function getCurationProvider(): LLMProvider {
  if (process.env.ANTHROPIC_API_KEY) return makeAnthropicProvider("ANTHROPIC_MODEL");
  return getLocalLLMProvider();
}

/**
 * Provider for lightweight text processing (track name cleaning etc).
 *
 * No game knowledge required — always uses the local model to avoid
 * burning API quota on simple string operations.
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
