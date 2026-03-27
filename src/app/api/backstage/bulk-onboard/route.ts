import { Games } from "@/lib/db/repo";
import { makeSSEStream, SSE_HEADERS } from "@/lib/sse";
import { quickOnboard } from "@/lib/pipeline/onboarding";
import { OnboardingPhase } from "@/types";

type BulkOnboardEvent =
  | { type: "game-start"; gameId: string; title: string; index: number; total: number }
  | { type: "game-progress"; gameId: string; message: string }
  | {
      type: "game-done";
      gameId: string;
      trackCount: number;
      tagged: number;
      resolved: number;
    }
  | { type: "game-error"; gameId: string; message: string }
  | { type: "all-done"; succeeded: number; failed: number };

/** POST /api/backstage/bulk-onboard — run quick-onboard on multiple games via SSE */
export async function POST(req: Request) {
  const { gameIds } = (await req.json()) as { gameIds: string[] };

  if (!Array.isArray(gameIds) || gameIds.length === 0) {
    return new Response(
      `data: ${JSON.stringify({ type: "game-error", gameId: "", message: "gameIds array is required" })}\n\n`,
      { headers: SSE_HEADERS },
    );
  }

  const { stream, send, close } = makeSSEStream<BulkOnboardEvent>();

  (async () => {
    let succeeded = 0;
    let failed = 0;

    for (let i = 0; i < gameIds.length; i++) {
      const game = Games.getById(gameIds[i]);
      if (!game) {
        send({ type: "game-error", gameId: gameIds[i], message: "Not found" });
        failed++;
        continue;
      }

      send({
        type: "game-start",
        gameId: game.id,
        title: game.title,
        index: i,
        total: gameIds.length,
      });

      try {
        const result = await quickOnboard(game, (message) =>
          send({ type: "game-progress", gameId: game.id, message }),
        );
        send({
          type: "game-done",
          gameId: game.id,
          trackCount: result.trackCount,
          tagged: result.tagged,
          resolved: result.resolved,
        });
        succeeded++;
      } catch (err) {
        Games.setPhase(game.id, OnboardingPhase.Failed);
        console.error(`[bulk-onboard] ${game.title}:`, err);
        send({
          type: "game-error",
          gameId: game.id,
          message: err instanceof Error ? err.message : String(err),
        });
        failed++;
      }
    }

    send({ type: "all-done", succeeded, failed });
    close();
  })();

  return new Response(stream, { headers: SSE_HEADERS });
}
