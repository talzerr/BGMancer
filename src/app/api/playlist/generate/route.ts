import { env } from "@/lib/env";
import {
  generatePlaylist,
  generatePlaylistForGuest,
  type GenerateEvent,
} from "@/lib/pipeline/index";
import { Users } from "@/lib/db/repo";
import { getAuthSession } from "@/lib/services/auth-helpers";
import { YouTubeQuotaError, YouTubeInvalidKeyError } from "@/lib/services/youtube";
import { GENERATION_COOLDOWN_MS, DEFAULT_TRACK_COUNT } from "@/lib/constants";
import { makeSSEStream, SSE_HEADERS } from "@/lib/sse";
import { generateSchema } from "@/lib/validation";
import { checkGuestRateLimit, getClientIp, acquireUserGeneration } from "@/lib/rate-limit";
import { verifyTurnstileToken } from "@/lib/services/turnstile";
import type { AppConfig } from "@/types";
import { createLogger } from "@/lib/logger";

const log = createLogger("generate");

export type { GenerateEvent };

function sseError(message: string, status?: number): Response {
  return new Response(`data: ${JSON.stringify({ type: "error", message })}\n\n`, {
    headers: SSE_HEADERS,
    ...(status ? { status } : {}),
  });
}

/**
 * POST /api/playlist/generate
 *
 * Thin SSE wrapper around the generate pipeline.
 * Streams progress events while building the playlist.
 *
 * Authenticated users: full pipeline (Vibe Profiler + Director), persisted to DB.
 * Guests: Director-only, no persistence. Must send gameSelections in body.
 */
export async function POST(request: Request) {
  if (!env.youtubeApiKey) {
    return sseError(
      "YouTube API key is not configured. Add YOUTUBE_API_KEY to .env.local and restart the server.",
    );
  }

  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    // empty body is fine — use defaults
  }

  const parsed = generateSchema.safeParse(body);
  if (!parsed.success) {
    return sseError("Invalid request body");
  }

  const config: AppConfig = {
    target_track_count: parsed.data.target_track_count ?? DEFAULT_TRACK_COUNT,
    allow_long_tracks: parsed.data.allow_long_tracks ?? false,
    allow_short_tracks: parsed.data.allow_short_tracks ?? false,
    anti_spoiler_enabled: parsed.data.anti_spoiler_enabled ?? false,
    raw_vibes: parsed.data.raw_vibes ?? false,
  };

  const session = await getAuthSession();
  const { stream, send, close } = makeSSEStream<GenerateEvent>();

  if (session.authenticated) {
    // ── Authenticated: full pipeline with Vibe Profiler + persistence ──
    const userId = session.userId;

    const cap = await acquireUserGeneration(userId);
    if (cap) {
      return sseError(cap.error);
    }

    const lock = await Users.tryAcquireGenerationLock(userId, GENERATION_COOLDOWN_MS);
    if (!lock.acquired) {
      return new Response(`data: ${JSON.stringify({ type: "error", message: lock.reason })}\n\n`, {
        headers: SSE_HEADERS,
      });
    }

    (async () => {
      try {
        await generatePlaylist(send, userId, config);
      } catch (err) {
        if (err instanceof YouTubeQuotaError || err instanceof YouTubeInvalidKeyError) {
          log.error("YouTube fatal error", { errorName: err.name });
          send({ type: "error", message: err.message });
        } else {
          log.error("generation failed", {}, err);
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
  } else {
    // ── Guest: Director-only, no Vibe Profiler, no persistence ──
    const turnstile = await verifyTurnstileToken(
      parsed.data.turnstileToken ?? "",
      getClientIp(request),
    );
    if (!turnstile.success) {
      return sseError(turnstile.error ?? "Verification failed");
    }

    const limited = await checkGuestRateLimit(request);
    if (limited) {
      return sseError(`Please wait ${limited.waitSec}s before trying again.`);
    }

    const gameSelections = parsed.data.gameSelections ?? [];

    if (gameSelections.length === 0) {
      return sseError("Select some games from the Catalog to generate a playlist.");
    }

    (async () => {
      try {
        await generatePlaylistForGuest(send, gameSelections, config);
      } catch (err) {
        log.error("guest generation failed", {}, err);
        send({
          type: "error",
          message: "Generation failed",
          detail: err instanceof Error ? err.message : String(err),
        });
      } finally {
        close();
      }
    })();
  }

  return new Response(stream, { headers: SSE_HEADERS });
}
