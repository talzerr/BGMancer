import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { Playlist } from "@/lib/db/repo";
import { findBestVideo, YouTubeInvalidKeyError } from "@/lib/services/youtube";
import { runConcurrent } from "@/lib/concurrency";
import { withRequiredAuth } from "@/lib/services/route-wrappers";

const SEARCH_CONCURRENCY = 5;

/**
 * POST /api/playlist/search
 *
 * Searches YouTube for all "pending" playlist tracks and updates them.
 * Each pending track has pre-generated search_queries from the LLM step.
 *
 * Videos longer than 15 minutes are rejected (likely compilations, not individual tracks).
 */
export const POST = withRequiredAuth(async (userId) => {
  if (!env.youtubeApiKey) {
    return NextResponse.json(
      {
        error:
          "YouTube API key is not configured. Add YOUTUBE_API_KEY to .env.local and restart the server.",
      },
      { status: 503 },
    );
  }

  const pendingRows = await Playlist.listPending(userId);

  if (pendingRows.length === 0) {
    return NextResponse.json({ message: "No pending tracks to search.", updated: 0 });
  }

  let updated = 0;
  let failed = 0;

  await runConcurrent(pendingRows, SEARCH_CONCURRENCY, async (row) => {
    const queries = row.search_queries ?? [];

    await Playlist.setSearching(row.id);

    try {
      const video = await findBestVideo(queries);

      if (video) {
        await Playlist.setFound(
          row.id,
          video.videoId,
          video.title,
          video.channelTitle,
          video.thumbnail,
          video.durationSeconds,
        );
        updated++;
      } else {
        await Playlist.setError(row.id, "No suitable video found after trying all queries.");
        failed++;
      }
    } catch (err) {
      if (err instanceof YouTubeInvalidKeyError) throw err;
      await Playlist.setError(row.id, err instanceof Error ? err.message : "YouTube search failed");
      failed++;
    }
  });

  return NextResponse.json({
    updated,
    failed,
    tracks: await Playlist.listAllWithGameTitle(userId),
  });
}, "POST /api/playlist/search");
