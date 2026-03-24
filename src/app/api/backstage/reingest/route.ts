import { Games, Tracks, ReviewFlags } from "@/lib/db/repo";
import { makeSSEStream, SSE_HEADERS } from "@/lib/sse";
import { ingestFromDiscogs } from "@/lib/pipeline/onboarding";
import { TaggingStatus, ReviewReason, UserTier } from "@/types";

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

  const { stream, send, close } = makeSSEStream<ReingestEvent>();

  (async () => {
    try {
      send({ type: "progress", message: "Clearing existing tracks…" });
      Tracks.deleteByGame(gameId);
      ReviewFlags.clearByGame(gameId);
      Games.setStatus(gameId, TaggingStatus.Indexing);

      const result = await ingestFromDiscogs(game, UserTier.Maestro, (msg) =>
        send({ type: "progress", message: msg }),
      );

      if (!result) {
        ReviewFlags.markAsNeedsReview(gameId, ReviewReason.NoDiscogsData);
        Games.setStatus(gameId, TaggingStatus.Limited);
        send({ type: "error", message: "No Discogs data found for this game." });
        return;
      }

      Games.setStatus(gameId, TaggingStatus.Ready);

      const finalTracks = Tracks.getByGame(gameId);
      const tagged = finalTracks.filter((t) => t.taggedAt !== null).length;
      const updatedGame = Games.getById(gameId);
      const needsReview = updatedGame?.needs_review ? 1 : 0;

      send({ type: "done", trackCount: finalTracks.length, tagged, needsReview });
    } catch (err) {
      Games.setStatus(gameId, TaggingStatus.Failed);
      console.error("[POST /api/backstage/reingest]", err);
      send({ type: "error", message: err instanceof Error ? err.message : String(err) });
    } finally {
      close();
    }
  })();

  return new Response(stream, { headers: SSE_HEADERS });
}
