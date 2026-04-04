import { BackstageGames, Games } from "@/lib/db/repo";
import { makeSSEStream, SSE_HEADERS, sanitizeErrorMessage } from "@/lib/sse";
import { loadTracks } from "@/lib/pipeline/onboarding";
import { OnboardingPhase, SSEEventType } from "@/types";
import { createLogger } from "@/lib/logger";
import { assertBackstageAuth } from "@/lib/services/cloudflare-access";

const log = createLogger("backstage-load-tracks");

type LoadTracksEvent =
  | { type: SSEEventType.Progress; message: string }
  | { type: SSEEventType.Done; trackCount: number }
  | { type: SSEEventType.Error; message: string };

/** POST /api/backstage/load-tracks — fetch tracklist from Discogs */
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

  const { stream, send, close } = makeSSEStream<LoadTracksEvent>();

  (async () => {
    try {
      const result = await loadTracks(game, (message) =>
        send({ type: SSEEventType.Progress, message }),
      );

      if (!result) {
        send({ type: SSEEventType.Error, message: "No Discogs data found for this game." });
        return;
      }

      send({ type: SSEEventType.Done, trackCount: result.trackCount });
    } catch (err) {
      await BackstageGames.setPhase(gameId, OnboardingPhase.Failed);
      log.error("handler failed", {}, err);
      send({ type: SSEEventType.Error, message: sanitizeErrorMessage(err) });
    } finally {
      close();
    }
  })();

  return new Response(stream, { headers: SSE_HEADERS });
}
