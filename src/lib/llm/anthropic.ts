import Anthropic from "@anthropic-ai/sdk";
import type { LLMProvider, CompletionOptions } from "./provider";
import { DEFAULT_LLM_MODEL, DEFAULT_LLM_MAX_TOKENS } from "@/lib/constants";

export class AnthropicProvider implements LLMProvider {
  private client: Anthropic;
  private model: string;

  constructor(model = DEFAULT_LLM_MODEL) {
    this.client = new Anthropic();
    this.model = model;
  }

  async complete(system: string, user: string, opts: CompletionOptions = {}): Promise<string> {
    const systemPayload = opts.cacheSystem
      ? [{ type: "text" as const, text: system, cache_control: { type: "ephemeral" as const } }]
      : system;

    const message = await this.client.messages.create(
      {
        model: this.model,
        max_tokens: opts.maxTokens ?? DEFAULT_LLM_MAX_TOKENS,
        system: systemPayload,
        messages: [{ role: "user", content: user }],
        temperature: opts.temperature ?? 0.7,
      },
      opts.signal ? { signal: opts.signal } : undefined,
    );

    const block = message.content[0];
    if (!block || block.type !== "text" || !block.text.trim()) {
      throw new Error(`Anthropic returned an empty response (stop_reason: ${message.stop_reason})`);
    }
    return block.text.trim();
  }
}
