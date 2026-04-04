import { BackstageGames, Games } from "@/lib/db/repo";
import { makeSSEStream, SSE_HEADERS, sanitizeErrorMessage } from "@/lib/sse";
import { quickOnboard } from "@/lib/pipeline/onboarding";
import { OnboardingPhase, SSEEventType } from "@/types";
import { createLogger } from "@/lib/logger";
import { assertBackstageAuth } from "@/lib/services/cloudflare-access";

const log = createLogger("backstage-onboard");

type QuickOnboardEvent =
  | { type: SSEEventType.Progress; message: string; current?: number; total?: number }
  | { type: SSEEventType.Done; trackCount: number; tagged: number; resolved: number }
  | { type: SSEEventType.Error; message: string };

/** POST /api/backstage/quick-onboard — run all onboarding phases and publish */
export async function POST(req: Request) {
  assertBackstageAuth(req);
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
  const { stream, send, close } = makeSSEStream<QuickOnboardEvent>();

  // Abort the pipeline when the client disconnects
  req.signal.addEventListener("abort", () => abort.abort());

  (async () => {
    try {
      const result = await quickOnboard(
        game,
        (message, current, total) => send({ type: SSEEventType.Progress, message, current, total }),
        abort.signal,
      );
      send({
        type: SSEEventType.Done,
        trackCount: result.trackCount,
        tagged: result.tagged,
        resolved: result.resolved,
      });
    } catch (err) {
      if (abort.signal.aborted) {
        send({ type: SSEEventType.Error, message: "Cancelled" });
      } else {
        await BackstageGames.setPhase(gameId, OnboardingPhase.Failed);
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
