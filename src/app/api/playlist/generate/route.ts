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
import type { AppConfig } from "@/types";

export type { GenerateEvent };

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
    return new Response(
      `data: ${JSON.stringify({ type: "error", message: "YouTube API key is not configured. Add YOUTUBE_API_KEY to .env.local and restart the server." })}\n\n`,
      { headers: SSE_HEADERS },
    );
  }

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

  const session = await getAuthSession();
  const { stream, send, close } = makeSSEStream<GenerateEvent>();

  if (session.authenticated) {
    // ── Authenticated: full pipeline with Vibe Profiler + persistence ──
    const userId = session.userId;

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
  } else {
    // ── Guest: Director-only, no Vibe Profiler, no persistence ──
    const gameSelections = Array.isArray(body.gameSelections) ? body.gameSelections : [];

    if (gameSelections.length === 0) {
      return new Response(
        `data: ${JSON.stringify({ type: "error", message: "Select some games from the Catalog to generate a playlist." })}\n\n`,
        { headers: SSE_HEADERS },
      );
    }

    (async () => {
      try {
        await generatePlaylistForGuest(send, gameSelections, config);
      } catch (err) {
        console.error("[POST /api/playlist/generate] (guest)", err);
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
