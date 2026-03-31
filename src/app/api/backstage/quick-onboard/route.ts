import { BackstageGames, Games } from "@/lib/db/repo";
import { makeSSEStream, SSE_HEADERS } from "@/lib/sse";
import { quickOnboard } from "@/lib/pipeline/onboarding";
import { OnboardingPhase } from "@/types";

type QuickOnboardEvent =
  | { type: "progress"; message: string; current?: number; total?: number }
  | { type: "done"; trackCount: number; tagged: number; resolved: number }
  | { type: "error"; message: string };

/** POST /api/backstage/quick-onboard — run all onboarding phases and publish */
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
  const { stream, send, close } = makeSSEStream<QuickOnboardEvent>();

  // Abort the pipeline when the client disconnects
  req.signal.addEventListener("abort", () => abort.abort());

  (async () => {
    try {
      const result = await quickOnboard(
        game,
        (message, current, total) => send({ type: "progress", message, current, total }),
        abort.signal,
      );
      send({
        type: "done",
        trackCount: result.trackCount,
        tagged: result.tagged,
        resolved: result.resolved,
      });
    } catch (err) {
      if (abort.signal.aborted) {
        send({ type: "error", message: "Cancelled" });
      } else {
        await BackstageGames.setPhase(gameId, OnboardingPhase.Failed);
        console.error("[POST /api/backstage/quick-onboard]", err);
        send({ type: "error", message: err instanceof Error ? err.message : String(err) });
      }
    } finally {
      close();
    }
  })();

  return new Response(stream, { headers: SSE_HEADERS });
}
