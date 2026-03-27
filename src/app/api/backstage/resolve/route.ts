import { Games, Tracks } from "@/lib/db/repo";
import { makeSSEStream, SSE_HEADERS } from "@/lib/sse";
import { resolveVideos } from "@/lib/pipeline/onboarding";
import { OnboardingPhase } from "@/types";

type ResolveEvent =
  | { type: "progress"; message: string }
  | { type: "done"; resolved: number; total: number }
  | { type: "error"; message: string };

/** POST /api/backstage/resolve — discover YouTube playlist and map tracks to video IDs */
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

  if (!Tracks.hasData(gameId)) {
    return new Response(
      `data: ${JSON.stringify({ type: "error", message: "No tracks loaded — run Load Tracks first" })}\n\n`,
      { headers: SSE_HEADERS },
    );
  }

  if (!Tracks.isTagged(gameId)) {
    return new Response(
      `data: ${JSON.stringify({ type: "error", message: "Tracks not tagged — run Tag first" })}\n\n`,
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
        (message) => send({ type: "progress", message }),
        abort.signal,
      );
      send({ type: "done", resolved: result.resolved, total: result.total });
    } catch (err) {
      Games.setPhase(gameId, OnboardingPhase.Failed);
      console.error("[POST /api/backstage/resolve]", err);
      send({ type: "error", message: err instanceof Error ? err.message : String(err) });
    } finally {
      close();
    }
  })();

  return new Response(stream, { headers: SSE_HEADERS });
}
