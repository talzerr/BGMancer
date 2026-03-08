import { NextResponse } from "next/server";
import { Playlist } from "@/lib/db/repo";
import { findBestVideo, YouTubeInvalidKeyError } from "@/lib/services/youtube";

/**
 * POST /api/playlist/search
 *
 * Searches YouTube for all "pending" playlist tracks and updates them.
 * Each pending track has pre-generated search_queries from the LLM step.
 *
 * Full-OST tracks require a video >= 15 minutes.
 * Individual tracks accept any length.
 */
export async function POST() {
  if (!process.env.YOUTUBE_API_KEY) {
    return NextResponse.json(
      { error: "YouTube API key is not configured. Add YOUTUBE_API_KEY to .env.local and restart the server." },
      { status: 503 }
    );
  }

  try {
    const pendingRows = Playlist.listPending();

    if (pendingRows.length === 0) {
      return NextResponse.json({ message: "No pending tracks to search.", updated: 0 });
    }

    let updated = 0;
    let failed = 0;

    for (const row of pendingRows) {
      const queries = row.search_queries ?? [];
      const allowShortVideo = !row.allow_full_ost;

      Playlist.setSearching(row.id);

      try {
        const video = await findBestVideo(queries, allowShortVideo);

        if (video) {
          Playlist.setFound(row.id, video.videoId, video.title, video.channelTitle, video.thumbnail, video.durationSeconds);
          updated++;
        } else {
          Playlist.setError(row.id, "No suitable video found after trying all queries.");
          failed++;
        }
      } catch (err) {
        if (err instanceof YouTubeInvalidKeyError) throw err;
        Playlist.setError(row.id, err instanceof Error ? err.message : "YouTube search failed");
        failed++;
      }
    }

    return NextResponse.json({ updated, failed, tracks: Playlist.listAllWithGameTitle() });
  } catch (err) {
    console.error("[POST /api/playlist/search]", err);
    const status = err instanceof YouTubeInvalidKeyError ? 503 : 500;
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Search step failed" },
      { status }
    );
  }
}
