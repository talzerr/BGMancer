import { Games, Tracks } from "@/lib/db/repo";
import { tagTracks } from "@/lib/pipeline/tagger";
import { getTaggingProvider } from "@/lib/llm";
import { UserTier } from "@/types";

type RetagEvent =
  | { type: "progress"; current: number; total: number; trackName: string }
  | { type: "done"; tagged: number; needsReview: number }
  | { type: "error"; message: string };

function makeStream() {
  const encoder = new TextEncoder();
  let controller: ReadableStreamDefaultController<Uint8Array>;

  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      controller = c;
    },
  });

  const send = (event: RetagEvent) => {
    controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
  };
  const close = () => controller.close();

  return { stream, send, close };
}

/** POST /api/backstage/retag — clear tags and re-run LLM tagger for a game */
export async function POST(req: Request) {
  const { gameId } = (await req.json()) as { gameId: string };

  if (!gameId) {
    return new Response(
      `data: ${JSON.stringify({ type: "error", message: "gameId is required" })}\n\n`,
      { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" } },
    );
  }

  const game = Games.getById(gameId);
  if (!game) {
    return new Response(
      `data: ${JSON.stringify({ type: "error", message: "Game not found" })}\n\n`,
      { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" } },
    );
  }

  const { stream, send, close } = makeStream();

  (async () => {
    try {
      Tracks.clearTags(gameId);

      const tracks = Tracks.getByGame(gameId);
      const total = tracks.length;

      send({ type: "progress", current: 0, total, trackName: "Starting…" });

      const provider = getTaggingProvider(UserTier.Maestro);
      await tagTracks(gameId, game.title, tracks, provider);

      const tagged = Tracks.getByGame(gameId).filter((t) => t.taggedAt !== null).length;
      const needsReview = game.needs_review ? 1 : 0;

      send({ type: "done", tagged, needsReview });
    } catch (err) {
      console.error("[POST /api/backstage/retag]", err);
      send({ type: "error", message: err instanceof Error ? err.message : String(err) });
    } finally {
      close();
    }
  })();

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "X-Accel-Buffering": "no",
    },
  });
}
