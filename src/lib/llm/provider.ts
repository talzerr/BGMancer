export interface CompletionOptions {
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
  /** When true, the system prompt is marked for Anthropic prompt caching. */
  cacheSystem?: boolean;
}

export interface LLMProvider {
  /**
   * Send a chat completion request.
   *
   * @param system - The system prompt (role instructions).
   * @param user   - The user message / task.
   * @param opts   - Optional tuning parameters.
   * @returns The model's text response, trimmed.
   */
  complete(system: string, user: string, opts?: CompletionOptions): Promise<string>;
}
