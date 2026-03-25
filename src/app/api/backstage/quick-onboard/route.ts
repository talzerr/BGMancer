import { Games } from "@/lib/db/repo";
import { makeSSEStream, SSE_HEADERS } from "@/lib/sse";
import { quickOnboard } from "@/lib/pipeline/onboarding";
import { OnboardingPhase } from "@/types";

type QuickOnboardEvent =
  | { type: "progress"; message: string }
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

  const game = Games.getById(gameId);
  if (!game) {
    return new Response(
      `data: ${JSON.stringify({ type: "error", message: "Game not found" })}\n\n`,
      { headers: SSE_HEADERS },
    );
  }

  const { stream, send, close } = makeSSEStream<QuickOnboardEvent>();

  (async () => {
    try {
      const result = await quickOnboard(game, (message) => send({ type: "progress", message }));
      send({
        type: "done",
        trackCount: result.trackCount,
        tagged: result.tagged,
        resolved: result.resolved,
      });
    } catch (err) {
      Games.setPhase(gameId, OnboardingPhase.Failed);
      console.error("[POST /api/backstage/quick-onboard]", err);
      send({ type: "error", message: err instanceof Error ? err.message : String(err) });
    } finally {
      close();
    }
  })();

  return new Response(stream, { headers: SSE_HEADERS });
}
