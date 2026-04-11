import { createLogger } from "@/lib/logger";
import { getSessionNamingProvider } from "@/lib/llm";
import {
  SESSION_NAMING_SYSTEM_PROMPT,
  buildSessionNamingUserPrompt,
  parseSessionName,
  type SessionNamingGame,
} from "@/lib/prompts/session-naming";
import type { LLMProvider } from "@/lib/llm/provider";
import type { Game, PlaylistMode } from "@/types";

const log = createLogger("session-naming");

export interface SessionNameOptions {
  playlistMode: PlaylistMode;
  provider?: LLMProvider;
}

export async function generateSessionName(
  games: Game[],
  options: SessionNameOptions,
): Promise<string | null> {
  if (games.length === 0) return null;

  const provider = options.provider ?? getSessionNamingProvider();

  const input: SessionNamingGame[] = games.map((g) => ({
    title: g.title,
    curation: g.curation,
  }));

  try {
    const raw = await provider.complete(
      SESSION_NAMING_SYSTEM_PROMPT,
      buildSessionNamingUserPrompt(input, options.playlistMode),
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
