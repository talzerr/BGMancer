import { BackstageGames, Games } from "@/lib/db/repo";
import { makeSSEStream, SSE_HEADERS } from "@/lib/sse";
import { loadTracks } from "@/lib/pipeline/onboarding";
import { OnboardingPhase } from "@/types";

type LoadTracksEvent =
  | { type: "progress"; message: string }
  | { type: "done"; trackCount: number }
  | { type: "error"; message: string };

/** POST /api/backstage/load-tracks — fetch tracklist from Discogs */
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

  const { stream, send, close } = makeSSEStream<LoadTracksEvent>();

  (async () => {
    try {
      const result = await loadTracks(game, (message) => send({ type: "progress", message }));

      if (!result) {
        send({ type: "error", message: "No Discogs data found for this game." });
        return;
      }

      send({ type: "done", trackCount: result.trackCount });
    } catch (err) {
      BackstageGames.setPhase(gameId, OnboardingPhase.Failed);
      console.error("[POST /api/backstage/load-tracks]", err);
      send({ type: "error", message: err instanceof Error ? err.message : String(err) });
    } finally {
      close();
    }
  })();

  return new Response(stream, { headers: SSE_HEADERS });
}
