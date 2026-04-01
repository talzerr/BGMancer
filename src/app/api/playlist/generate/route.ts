import { env } from "@/lib/env";
import { generatePlaylist, type GenerateEvent } from "@/lib/pipeline/index";
import { Users } from "@/lib/db/repo";
import { getAuthSession } from "@/lib/services/auth-helpers";
import { YouTubeQuotaError, YouTubeInvalidKeyError } from "@/lib/services/youtube";
import { GENERATION_COOLDOWN_MS, DEFAULT_TRACK_COUNT } from "@/lib/constants";
import { makeSSEStream, SSE_HEADERS } from "@/lib/sse";
import type { AppConfig } from "@/types";

export type { GenerateEvent };

/**
 * POST /api/playlist/generate
 *
 * Thin SSE wrapper around the generate pipeline.
 * Streams progress events while building the playlist.
 * Expects JSON body with optional config overrides: { target_track_count?, allow_long_tracks? }
 *
 * Authenticated users: full pipeline (Vibe Profiler + Director), persisted to DB.
 * Guests: not yet supported — returns 401.
 */
export async function POST(request: Request) {
  if (!env.youtubeApiKey) {
    return new Response(
      `data: ${JSON.stringify({ type: "error", message: "YouTube API key is not configured. Add YOUTUBE_API_KEY to .env.local and restart the server." })}\n\n`,
      { headers: SSE_HEADERS },
    );
  }

  const session = await getAuthSession();
  if (!session.authenticated) {
    return new Response(
      `data: ${JSON.stringify({ type: "error", message: "Sign in to generate playlists." })}\n\n`,
      { headers: SSE_HEADERS, status: 401 },
    );
  }

  const userId = session.userId;

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
    allow_short_tracks: body.allow_short_tracks === true,
    anti_spoiler_enabled: body.anti_spoiler_enabled === true,
    raw_vibes: body.raw_vibes === true,
  };

  const lock = await Users.tryAcquireGenerationLock(userId, GENERATION_COOLDOWN_MS);
  if (!lock.acquired) {
    return new Response(`data: ${JSON.stringify({ type: "error", message: lock.reason })}\n\n`, {
      headers: SSE_HEADERS,
    });
  }

  const { stream, send, close } = makeSSEStream<GenerateEvent>();

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
      await Users.releaseGenerationLock(userId);
      close();
    }
  })();

  return new Response(stream, { headers: SSE_HEADERS });
}
