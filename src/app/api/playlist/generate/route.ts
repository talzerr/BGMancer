import { cookies } from "next/headers";
import { generatePlaylist, type GenerateEvent } from "@/lib/pipeline/index";
import { Users } from "@/lib/db/repo";
import { getOrCreateUserId } from "@/lib/services/session";
import { YouTubeQuotaError, YouTubeInvalidKeyError } from "@/lib/services/youtube";
import { GENERATION_COOLDOWN_MS, DEFAULT_TRACK_COUNT } from "@/lib/constants";
import type { AppConfig } from "@/types";

export type { GenerateEvent };

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
 * Expects JSON body with optional config overrides: { target_track_count?, allow_long_tracks? }
 */
export async function POST(request: Request) {
  if (!process.env.YOUTUBE_API_KEY) {
    return new Response(
      `data: ${JSON.stringify({ type: "error", message: "YouTube API key is not configured. Add YOUTUBE_API_KEY to .env.local and restart the server." })}\n\n`,
      { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" } },
    );
  }

  // Parse config from request body (sent by the client from localStorage).
  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    // empty body is fine — use defaults
  }

  const config: AppConfig = {
    target_track_count: Number(body.target_track_count) || DEFAULT_TRACK_COUNT,
    allow_long_tracks: body.allow_long_tracks === true,
    anti_spoiler_enabled: body.anti_spoiler_enabled === true,
    youtube_playlist_id: "",
  };

  const cookieStore = await cookies();
  const userId = await getOrCreateUserId(cookieStore);
  Users.getOrCreate(userId);

  const lock = Users.tryAcquireGenerationLock(userId, GENERATION_COOLDOWN_MS);
  if (!lock.acquired) {
    return new Response(`data: ${JSON.stringify({ type: "error", message: lock.reason })}\n\n`, {
      headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
    });
  }

  const { stream, send, close } = makeStream();

  (async () => {
    try {
      await generatePlaylist(send, userId, config);
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
      Users.releaseGenerationLock(userId);
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
