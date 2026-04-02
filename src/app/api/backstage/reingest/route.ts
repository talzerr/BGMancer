import { BackstageGames, Games, Tracks, ReviewFlags } from "@/lib/db/repo";
import { makeSSEStream, SSE_HEADERS } from "@/lib/sse";
import { loadTracks, resolveVideos, tagGameTracks } from "@/lib/pipeline/onboarding";
import { OnboardingPhase, ReviewReason } from "@/types";
import { createLogger } from "@/lib/logger";

const log = createLogger("backstage-reingest");

type ReingestEvent =
  | { type: "progress"; message: string }
  | { type: "done"; trackCount: number; resolved: number; tagged: number; needsReview: number }
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

  const game = await Games.getById(gameId);
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
      await Tracks.deleteByGame(gameId);
      await ReviewFlags.clearByGame(gameId);
      await BackstageGames.setPhase(gameId, OnboardingPhase.Draft);

      const progress = (message: string) => send({ type: "progress", message });

      const loaded = await loadTracks(game, progress);
      if (!loaded) {
        send({ type: "error", message: "No Discogs data found for this game." });
        return;
      }

      let resolveResult: { resolved: number; total: number };
      try {
        resolveResult = await resolveVideos(game, progress, abort.signal);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        await ReviewFlags.markAsNeedsReview(gameId, ReviewReason.NoTracklistSource, msg);
        send({ type: "error", message: `Video resolution failed: ${msg}` });
        return;
      }

      const tagResult = await tagGameTracks(game, progress, abort.signal);

      send({
        type: "done",
        trackCount: loaded.trackCount,
        resolved: resolveResult.resolved,
        tagged: tagResult.tagged,
        needsReview: tagResult.needsReview ? 1 : 0,
      });
    } catch (err) {
      if (abort.signal.aborted) {
        send({ type: "error", message: "Cancelled" });
      } else {
        await BackstageGames.setPhase(gameId, OnboardingPhase.Failed);
        log.error("handler failed", {}, err);
        send({ type: "error", message: err instanceof Error ? err.message : String(err) });
      }
    } finally {
      close();
    }
  })();

  return new Response(stream, { headers: SSE_HEADERS });
}
