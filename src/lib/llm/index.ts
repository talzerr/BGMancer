import type { LLMProvider } from "./provider";
import { OllamaProvider } from "./ollama";
import { AnthropicProvider } from "./anthropic";

/**
 * Returns the primary LLM provider.
 */
export function getLLMProvider(): LLMProvider {
  if (process.env.ANTHROPIC_API_KEY) {
    const model = process.env.ANTHROPIC_MODEL;
    return new AnthropicProvider(...(model ? [model] : []));
  }

  return getLocalLLMProvider();
}

/**
 * Returns a local LLM provider for tasks that don't require game knowledge.
 */
export function getLocalLLMProvider(): LLMProvider {
  const ollamaHost = process.env.OLLAMA_HOST ?? "http://localhost:11434";
  const ollamaModel = process.env.OLLAMA_MODEL ?? "llama3.2";
  return new OllamaProvider(ollamaHost, ollamaModel);
}

export type { LLMProvider } from "./provider";
