import { cookies } from "next/headers";
import { Games } from "@/lib/db/repo";
import { getOrCreateUserId } from "@/lib/services/session";
import { bus } from "@/lib/events";
import type { GameStatusPayload } from "@/lib/events";
import { TaggingStatus } from "@/types";

/**
 * GET /api/games/status-stream
 *
 * SSE stream that pushes game tagging status updates to the client.
 * On connect: sends the current status of all pending/indexing games.
 * Ongoing: pushes { gameId, status } whenever onboardGame() changes a game's status.
 */
export async function GET() {
  const cookieStore = await cookies();
  const userId = await getOrCreateUserId(cookieStore);

  const encoder = new TextEncoder();

  let unsubscribe: (() => void) | null = null;

  const stream = new ReadableStream({
    start(controller) {
      const send = (data: object) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch {
          // Stream already closed — swallow silently
        }
      };

      // Send current state for any games still in progress so the client
      // doesn't miss statuses that changed before the stream connected.
      const allGames = Games.listAllIncludingDisabled(userId);
      for (const game of allGames) {
        if (
          game.tagging_status === TaggingStatus.Indexing ||
          game.tagging_status === TaggingStatus.Pending
        ) {
          send({ gameId: game.id, status: game.tagging_status });
        }
      }

      // Subscribe to future status changes emitted by onboardGame()
      const handler = (payload: GameStatusPayload) => send(payload);
      bus.on("game:status", handler);
      unsubscribe = () => bus.off("game:status", handler);
    },

    // Called when the client disconnects — clean up the event listener
    cancel() {
      unsubscribe?.();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "X-Accel-Buffering": "no",
    },
  });
}
