import { Games, Tracks, ReviewFlags } from "@/lib/db/repo";
import { makeSSEStream, SSE_HEADERS } from "@/lib/sse";
import { loadTracks, tagGameTracks } from "@/lib/pipeline/onboarding";
import { OnboardingPhase } from "@/types";

type ReingestEvent =
  | { type: "progress"; message: string }
  | { type: "done"; trackCount: number; tagged: number; needsReview: number }
  | { type: "error"; message: string };

/** POST /api/backstage/reingest — clear all tracks and re-fetch from Discogs */
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

  const abort = new AbortController();
  const { stream, send, close } = makeSSEStream<ReingestEvent>();

  req.signal.addEventListener("abort", () => abort.abort());

  (async () => {
    try {
      send({ type: "progress", message: "Clearing existing tracks…" });
      Tracks.deleteByGame(gameId);
      ReviewFlags.clearByGame(gameId);
      Games.setPhase(gameId, OnboardingPhase.Draft);

      const progress = (message: string) => send({ type: "progress", message });

      const loaded = await loadTracks(game, progress);
      if (!loaded) {
        send({ type: "error", message: "No Discogs data found for this game." });
        return;
      }

      const tagResult = await tagGameTracks(game, progress, abort.signal);

      send({
        type: "done",
        trackCount: loaded.trackCount,
        tagged: tagResult.tagged,
        needsReview: tagResult.needsReview ? 1 : 0,
      });
    } catch (err) {
      Games.setPhase(gameId, OnboardingPhase.Failed);
      console.error("[POST /api/backstage/reingest]", err);
      send({ type: "error", message: err instanceof Error ? err.message : String(err) });
    } finally {
      close();
    }
  })();

  return new Response(stream, { headers: SSE_HEADERS });
}
