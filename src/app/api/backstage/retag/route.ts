import { BackstageGames, Games, Tracks } from "@/lib/db/repo";
import { tagTracks } from "@/lib/pipeline/tagger";
import { getTaggingProvider } from "@/lib/llm";
import { makeSSEStream, SSE_HEADERS } from "@/lib/sse";
import { OnboardingPhase } from "@/types";
import { createLogger } from "@/lib/logger";

const log = createLogger("backstage-retag");

type RetagEvent =
  | { type: "progress"; current: number; total: number; trackName: string }
  | { type: "done"; tagged: number; needsReview: number }
  | { type: "error"; message: string };

/** POST /api/backstage/retag — clear tags and re-run LLM tagger for a game */
export async function POST(req: Request) {
  const { gameId } = (await req.json()) as { gameId: string };

  if (!gameId) {
    return new Response(
      `data: ${JSON.stringify({ type: "error", message: "gameId is required" })}\n\n`,
      { headers: SSE_HEADERS },
    );
  }

  const game = await Games.getById(gameId);
  if (!game) {
    return new Response(
      `data: ${JSON.stringify({ type: "error", message: "Game not found" })}\n\n`,
      { headers: SSE_HEADERS },
    );
  }

  const abort = new AbortController();
  const { stream, send, close } = makeSSEStream<RetagEvent>();

  req.signal.addEventListener("abort", () => abort.abort());

  (async () => {
    try {
      await Tracks.clearTags(gameId);

      const tracks = await Tracks.getByGame(gameId);
      const total = tracks.length;

      send({ type: "progress", current: 0, total, trackName: "Starting…" });

      const provider = getTaggingProvider();
      await tagTracks(gameId, game.title, tracks, provider, abort.signal);

      await BackstageGames.setPhase(gameId, OnboardingPhase.Tagged);

      const tagged = (await Tracks.getByGame(gameId)).filter((t) => t.taggedAt !== null).length;
      const updatedGame = await Games.getById(gameId);
      const needsReview = updatedGame?.needs_review ? 1 : 0;

      send({ type: "done", tagged, needsReview });
    } catch (err) {
      if (abort.signal.aborted) {
        send({ type: "error", message: "Cancelled" });
      } else {
        log.error("handler failed", {}, err);
        send({ type: "error", message: err instanceof Error ? err.message : String(err) });
      }
    } finally {
      close();
    }
  })();

  return new Response(stream, { headers: SSE_HEADERS });
}
