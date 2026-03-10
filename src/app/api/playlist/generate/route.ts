import { generatePlaylist, type GenerateEvent } from "@/lib/pipeline/index";
import { YouTubeQuotaError, YouTubeInvalidKeyError } from "@/lib/services/youtube";
import { GENERATION_COOLDOWN_MS } from "@/lib/constants";

export type { GenerateEvent };

// TODO(multi-user): migrate to SQLite (sessions.is_generating + sessions.last_generated_at)
// when per-user sessions launch — user context isn't available at the route layer yet.
let isGenerating = false;
let lastGeneratedAt = 0;

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
    let ran = false;
    try {
      const now = Date.now();
      if (isGenerating) {
        send({
          type: "error",
          message: "A generation is already in progress. Please wait for it to finish.",
        });
        return;
      }
      const cooldownRemaining = GENERATION_COOLDOWN_MS - (now - lastGeneratedAt);
      if (cooldownRemaining > 0) {
        send({
          type: "error",
          message: `Please wait ${Math.ceil(cooldownRemaining / 1000)}s before generating again.`,
        });
        return;
      }
      isGenerating = true;
      ran = true;

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
      // Stamp after generation completes so the cooldown is measured from the END,
      // not the start. Only update if generation actually ran (not if it was rejected
      // by the isGenerating or cooldown guards above).
      if (ran) lastGeneratedAt = Date.now();
      isGenerating = false;
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
