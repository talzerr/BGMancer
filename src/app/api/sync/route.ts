import { NextResponse } from "next/server";
import { auth } from "@/lib/services/auth/auth";
import { Playlist, Sessions } from "@/lib/db/repo";
import { createLogger } from "@/lib/logger";
import { env } from "@/lib/env";
import {
  addVideoToPlaylist,
  createYoutubePlaylist,
  YouTubeOAuthError,
} from "@/lib/services/external/youtube";
import { runConcurrent } from "@/lib/concurrency";
import { checkRateLimit } from "@/lib/rate-limit";
import { syncRequestSchema } from "@/lib/validation";
import {
  YOUTUBE_SYNC_CONCURRENCY,
  YOUTUBE_SYNC_MAX_PER_HOUR,
  YOUTUBE_SYNC_WINDOW_MS,
} from "@/lib/constants";

const log = createLogger("sync");

/**
 * POST /api/sync
 *
 * Creates a new unlisted YouTube playlist named after the BGMancer session
 * and populates it with every track in that session that has a resolved
 * YouTube video ID. The YouTube playlist ID is persisted on the session row
 * so the UI can restore "✓ Synced" state across reloads.
 *
 * Does not use `withRequiredAuth` because the handler needs the full NextAuth
 * session (OAuth `access_token`), not just the userId.
 *
 * While Google OAuth verification is pending, the entire feature is gated
 * behind `env.youtubeSyncEnabled` and returns 503 when disabled.
 */
export async function POST(request: Request): Promise<Response> {
  if (!env.youtubeSyncEnabled) {
    return NextResponse.json({ error: "Feature not yet available" }, { status: 503 });
  }

  if (env.isDev) {
    return NextResponse.json({ error: "Sync is not available in development." }, { status: 400 });
  }

  try {
    const session = await auth();
    if (
      !session?.user?.id ||
      !session.access_token ||
      session.error === "RefreshAccessTokenError"
    ) {
      return NextResponse.json(
        { error: "YouTube permissions are needed to sync. Try again." },
        { status: 401 },
      );
    }

    const userId = session.user.id;
    const accessToken = session.access_token;

    const body = (await request.json().catch(() => null)) as unknown;
    const parsed = syncRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid sync request." }, { status: 400 });
    }
    const { sessionId } = parsed.data;

    const playlistSession = await Sessions.getById(sessionId);
    if (!playlistSession || playlistSession.user_id !== userId) {
      return NextResponse.json({ error: "Session not found." }, { status: 404 });
    }

    const syncable = await Playlist.listSyncableVideos(sessionId);
    if (syncable.length === 0) {
      return NextResponse.json(
        { error: "This session has no tracks with YouTube videos yet." },
        { status: 400 },
      );
    }

    const rl = await checkRateLimit(
      `youtube-sync:${userId}`,
      YOUTUBE_SYNC_MAX_PER_HOUR,
      YOUTUBE_SYNC_WINDOW_MS,
    );
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Please wait a few minutes before syncing again." },
        { status: 429 },
      );
    }

    const youtubePlaylistId = await createYoutubePlaylist(accessToken, {
      title: `BGMancer: ${playlistSession.name}`,
      description: "Created with BGMancer — bgmancer.com",
      privacy: "unlisted",
    });

    await Sessions.setYoutubePlaylistId(sessionId, youtubePlaylistId);

    const inserts = syncable.map((row, i) => ({ videoId: row.video_id, insertIndex: i }));
    let failed = 0;
    await runConcurrent(inserts, YOUTUBE_SYNC_CONCURRENCY, async (item) => {
      try {
        await addVideoToPlaylist(accessToken, youtubePlaylistId, item.videoId, item.insertIndex);
      } catch (err) {
        failed += 1;
        log.error("playlistItems.insert failed", { videoId: item.videoId }, err);
      }
    });

    return NextResponse.json({
      playlistId: youtubePlaylistId,
      playlistUrl: `https://www.youtube.com/playlist?list=${youtubePlaylistId}`,
      inserted: inserts.length - failed,
      failed,
    });
  } catch (err) {
    // YouTube error mapping. Everything else falls through to a masked 500.
    if (err instanceof YouTubeOAuthError) {
      if (err.status === 401) {
        return NextResponse.json(
          { error: "YouTube permissions are needed to sync. Try again." },
          { status: 401 },
        );
      }
      if (err.status === 403) {
        if (err.reason === "insufficientPermissions") {
          return NextResponse.json(
            { error: "YouTube permissions are needed to sync. Try again." },
            { status: 401 },
          );
        }
        if (err.reason === "youtubeSignupRequired") {
          return NextResponse.json(
            { error: "Enable YouTube on your Google account to sync." },
            { status: 400 },
          );
        }
        if (err.reason === "quotaExceeded") {
          return NextResponse.json(
            { error: "YouTube is rate-limiting us. Try again in a few minutes." },
            { status: 503 },
          );
        }
      }
    }
    log.error("sync handler failed", {}, err);
    return NextResponse.json({ error: "Couldn't create playlist. Try again." }, { status: 500 });
  }
}
