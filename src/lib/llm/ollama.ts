import { Ollama } from "ollama";
import type { LLMProvider, CompletionOptions } from "./provider";

const DEFAULT_HOST = "http://localhost:11434";
const DEFAULT_MODEL = "llama3.2";

// FIFO semaphore — Ollama runs locally, only one request at a time.
let ollamaBusy = false;
let ollamaWaiting = 0;
let ollamaTail: Promise<void> = Promise.resolve();

export class OllamaProvider implements LLMProvider {
  private client: Ollama;
  private model: string;

  constructor(host = DEFAULT_HOST, model = DEFAULT_MODEL) {
    this.client = new Ollama({ host });
    this.model = model;
  }

  async complete(system: string, user: string, opts: CompletionOptions = {}): Promise<string> {
    let release!: () => void;
    const lock = new Promise<void>((resolve) => {
      release = resolve;
    });
    const prev = ollamaTail;
    ollamaTail = lock;

    if (ollamaBusy) {
      ollamaWaiting++;
      console.warn(`[ollama] Request queued — ${ollamaWaiting} waiting behind an active request.`);
      await prev;
      ollamaWaiting--;
    } else {
      await prev; // resolves immediately when idle
    }

    ollamaBusy = true;
    try {
      const response = await this.client.chat({
        model: this.model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        options: {
          temperature: opts.temperature ?? 0.7,
          ...(opts.maxTokens ? { num_predict: opts.maxTokens } : {}),
        },
      });

      return response.message.content.trim();
    } finally {
      ollamaBusy = false;
      release();
    }
  }
}
