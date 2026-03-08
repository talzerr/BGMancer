import { generatePlaylist, type GenerateEvent } from "@/lib/generatePlaylist";
import { YouTubeQuotaError, YouTubeInvalidKeyError } from "@/lib/services/youtube";

export { type GenerateEvent } from "@/lib/generatePlaylist";

function makeStream() {
  const encoder = new TextEncoder();
  let controller: ReadableStreamDefaultController<Uint8Array>;

  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      controller = c;
    },
  });

  const send = (event: GenerateEvent) => {
    controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
  };

  const close = () => controller.close();

  return { stream, send, close };
}

/**
 * POST /api/playlist/generate
 *
 * Thin SSE wrapper around the generate pipeline.
 * Streams progress events while building the playlist.
 */
export async function POST() {
  if (!process.env.YOUTUBE_API_KEY) {
    return new Response(
      `data: ${JSON.stringify({ type: "error", message: "YouTube API key is not configured. Add YOUTUBE_API_KEY to .env.local and restart the server." })}\n\n`,
      { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" } },
    );
  }

  const { stream, send, close } = makeStream();

  (async () => {
    try {
      await generatePlaylist(send);
    } catch (err) {
      if (err instanceof YouTubeQuotaError || err instanceof YouTubeInvalidKeyError) {
        console.error(`[generate] YouTube fatal error — ${err.name}`);
        send({ type: "error", message: err.message });
      } else {
        console.error("[POST /api/playlist/generate]", err);
        send({
          type: "error",
          message: "Generation failed",
          detail: err instanceof Error ? err.message : String(err),
        });
      }
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
