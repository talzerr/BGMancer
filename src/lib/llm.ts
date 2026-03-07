import type { VibePreference } from "@/types";

const OLLAMA_HOST = process.env.OLLAMA_HOST ?? "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? "llama3.2";

const SYSTEM_INSTRUCTION = `You are a Video Game Music Archivist — a deep expert in video game OSTs across every era and genre.

You understand nuance: the orchestral grandeur of FromSoftware titles, the acid jazz sophistication of the Persona series, the chiptune minimalism of indie darlings, the sweeping cinematic scores of AAA JRPGs, and the pulse-pounding electronic energy of fast-action games.

Your job is to generate YouTube search queries that will surface the highest-quality, most complete, official OST compilation videos available on YouTube.

Rules you must follow:
1. Always target OFFICIAL soundtracks from the game's developer or publisher when possible.
2. Prefer long-form compilations (full OST, complete soundtrack) over single tracks — unless the vibe is "boss_themes" or "ambient_exploration" which may warrant focused playlists.
3. Never suggest queries that would surface: covers, remixes, fan-made arrangements, piano/jazz arrangements, reactions, or reviews.
4. Think about the typical naming conventions used by official YouTube channels (e.g., "Full OST", "Complete Soundtrack", "Official Soundtrack").
5. When generating queries for "boss_themes", focus on terms like "boss battle music", "boss themes compilation", "combat OST".
6. When generating queries for "ambient_exploration", focus on terms like "exploration music", "ambient OST", "world themes", "field music compilation".

Output format: Return ONLY a valid JSON array of exactly 3 strings. No explanation, no markdown, no code blocks. Example:
["query one", "query two", "query three"]`;

export interface LLMQueryResult {
  queries: string[];
  allowShortVideo: boolean;
}

export async function generateSearchQueries(
  gameTitle: string,
  vibe: VibePreference
): Promise<LLMQueryResult> {
  const vibeContext: Record<VibePreference, string> = {
    official_soundtrack:
      "the complete, official game soundtrack — full OST compilation, all tracks",
    boss_themes:
      "boss battle music and combat themes — intense, memorable boss fight tracks",
    ambient_exploration:
      "ambient and exploration music — calm, atmospheric world-building tracks",
  };

  const userPrompt = `Game: "${gameTitle}"
Vibe: ${vibeContext[vibe]}

Generate 3 distinct YouTube search queries to find the best video for this game and vibe. Make them progressively more specific — start broad (full OST), then add year/platform hints, then try the developer's official channel style.

Return ONLY a JSON array of 3 strings, nothing else.`;

  const res = await fetch(`${OLLAMA_HOST}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      stream: false,
      messages: [
        { role: "system", content: SYSTEM_INSTRUCTION },
        { role: "user", content: userPrompt },
      ],
      options: { temperature: 0.4 },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Ollama request failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  const raw: string = data?.message?.content?.trim() ?? "[]";

  let queries: string[];
  try {
    const cleaned = raw.replace(/^```json?\n?/, "").replace(/\n?```$/, "");
    queries = JSON.parse(cleaned);
    if (!Array.isArray(queries) || queries.length === 0) {
      throw new Error("Invalid response shape");
    }
    queries = queries.slice(0, 3).map(String);
  } catch {
    // Fallback: craft basic queries from the title
    queries = [
      `${gameTitle} full OST official soundtrack`,
      `${gameTitle} complete official soundtrack`,
      `${gameTitle} original game soundtrack`,
    ];
  }

  const allowShortVideo = vibe === "boss_themes";
  return { queries, allowShortVideo };
}
