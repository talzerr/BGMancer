import { createLogger } from "@/lib/logger";
import { getSessionNamingProvider } from "@/lib/llm";
import {
  SESSION_NAMING_SYSTEM_PROMPT,
  buildSessionNamingUserPrompt,
  parseSessionName,
  type SessionNamingGame,
} from "@/lib/prompts/session-naming";
import type { LLMProvider } from "@/lib/llm/provider";
import type { Game } from "@/types";

const log = createLogger("session-naming");

export async function generateSessionName(
  games: Game[],
  provider: LLMProvider = getSessionNamingProvider(),
): Promise<string | null> {
  if (games.length === 0) return null;

  const input: SessionNamingGame[] = games.map((g) => ({
    title: g.title,
    curation: g.curation,
  }));

  try {
    const raw = await provider.complete(
      SESSION_NAMING_SYSTEM_PROMPT,
      buildSessionNamingUserPrompt(input),
      {
        temperature: 0.9,
        maxTokens: 32,
        cacheSystem: true,
      },
    );
    return parseSessionName(raw);
  } catch (err) {
    log.error("session naming LLM call failed, falling back", {}, err);
    return null;
  }
}
