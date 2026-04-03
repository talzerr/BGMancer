import { BackstageGames, Games, Tracks } from "@/lib/db/repo";
import { makeSSEStream, SSE_HEADERS } from "@/lib/sse";
import { resolveVideos } from "@/lib/pipeline/onboarding";
import { OnboardingPhase, SSEEventType } from "@/types";
import { createLogger } from "@/lib/logger";

const log = createLogger("backstage-resolve");

type ResolveEvent =
  | { type: SSEEventType.Progress; message: string }
  | { type: SSEEventType.Done; resolved: number; total: number }
  | { type: SSEEventType.Error; message: string };

/** POST /api/backstage/resolve — discover YouTube playlist and map tracks to video IDs */
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

  if (!(await Tracks.hasData(gameId))) {
    return new Response(
      `data: ${JSON.stringify({ type: SSEEventType.Error, message: "No tracks loaded — run Load Tracks first" })}\n\n`,
      { headers: SSE_HEADERS },
    );
  }

  const abort = new AbortController();
  const { stream, send, close } = makeSSEStream<ResolveEvent>();

  req.signal.addEventListener("abort", () => abort.abort());

  (async () => {
    try {
      const result = await resolveVideos(
        game,
        (message) => send({ type: SSEEventType.Progress, message }),
        abort.signal,
      );
      send({ type: SSEEventType.Done, resolved: result.resolved, total: result.total });
    } catch (err) {
      if (abort.signal.aborted) {
        send({ type: SSEEventType.Error, message: "Cancelled" });
      } else {
        await BackstageGames.setPhase(gameId, OnboardingPhase.Failed);
        log.error("handler failed", {}, err);
        send({
          type: SSEEventType.Error,
          message: err instanceof Error ? err.message : String(err),
        });
      }
    } finally {
      close();
    }
  })();

  return new Response(stream, { headers: SSE_HEADERS });
}
