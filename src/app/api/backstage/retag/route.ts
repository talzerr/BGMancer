import { BackstageGames, Games, Tracks } from "@/lib/db/repo";
import { tagTracks } from "@/lib/pipeline/onboarding/tagger";
import { getTaggingProvider } from "@/lib/llm";
import { makeSSEStream, SSE_HEADERS, sanitizeErrorMessage } from "@/lib/sse";
import { OnboardingPhase, SSEEventType } from "@/types";
import { createLogger } from "@/lib/logger";

const log = createLogger("backstage-retag");

type RetagEvent =
  | { type: SSEEventType.Progress; current: number; total: number; trackName: string }
  | { type: SSEEventType.Done; tagged: number; needsReview: number }
  | { type: SSEEventType.Error; message: string };

/** POST /api/backstage/retag — clear tags and re-run LLM tagger for a game */
export async function POST(req: Request) {
  const { gameId } = (await req.json()) as { gameId: string };

  if (!gameId) {
    return new Response(
      `data: ${JSON.stringify({ type: SSEEventType.Error, message: "gameId is required" })}\n\n`,
      { headers: SSE_HEADERS },
    );
  }

  const game = await Games.getById(gameId);
  if (!game) {
    return new Response(
      `data: ${JSON.stringify({ type: SSEEventType.Error, message: "Game not found" })}\n\n`,
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

      const provider = getTaggingProvider();
      await tagTracks(
        gameId,
        game.title,
        tracks,
        provider,
        abort.signal,
        (current, total, trackName) =>
          send({ type: SSEEventType.Progress, current, total, trackName }),
      );

      await BackstageGames.setPhase(gameId, OnboardingPhase.Tagged);

      const tagged = await Tracks.countTagged(gameId);
      const updatedGame = await Games.getById(gameId);
      const needsReview = updatedGame?.needs_review ? 1 : 0;

      send({ type: SSEEventType.Done, tagged, needsReview });
    } catch (err) {
      if (abort.signal.aborted) {
        send({ type: SSEEventType.Error, message: "Cancelled" });
      } else {
        log.error("handler failed", {}, err);
        send({
          type: SSEEventType.Error,
          message: sanitizeErrorMessage(err),
        });
      }
    } finally {
      close();
    }
  })();

  return new Response(stream, { headers: SSE_HEADERS });
}
