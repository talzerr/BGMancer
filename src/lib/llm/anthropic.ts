import Anthropic from "@anthropic-ai/sdk";
import type { LLMProvider, CompletionOptions } from "./provider";

const DEFAULT_MODEL = "claude-haiku-4-5-20251001";
const DEFAULT_MAX_TOKENS = 2048;

export class AnthropicProvider implements LLMProvider {
  private client: Anthropic;
  private model: string;

  constructor(model = DEFAULT_MODEL) {
    this.client = new Anthropic();
    this.model = model;
  }

  async complete(system: string, user: string, opts: CompletionOptions = {}): Promise<string> {
    const message = await this.client.messages.create({
      model: this.model,
      max_tokens: opts.maxTokens ?? DEFAULT_MAX_TOKENS,
      system,
      messages: [{ role: "user", content: user }],
      temperature: opts.temperature ?? 0.7,
    });

    const block = message.content[0];
    if (!block) return "";
    return block.type === "text" ? block.text.trim() : "";
  }
}
