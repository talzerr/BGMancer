import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import { findBestVideo } from "@/lib/youtube";
import type { PlaylistTrack } from "@/types";

/**
 * POST /api/playlist/search
 *
 * Searches YouTube for all "pending" playlist tracks and updates them.
 * Each pending track has pre-generated search_queries from the LLM step.
 *
 * Full-OST tracks (track_name IS NULL) require a video ≥ 15 minutes.
 * Individual tracks (track_name IS NOT NULL) accept any length.
 */
export async function POST() {
  try {
    const db = getDB();

    const pendingRows = db.prepare(`
      SELECT pt.*, g.allow_full_ost
      FROM playlist_tracks pt
      JOIN games g ON g.id = pt.game_id
      WHERE pt.status = 'pending'
      ORDER BY pt.position ASC
    `).all() as Array<Record<string, unknown>>;

    if (pendingRows.length === 0) {
      return NextResponse.json({ message: "No pending tracks to search.", updated: 0 });
    }

    const setSearching = db.prepare(
      "UPDATE playlist_tracks SET status = 'searching' WHERE id = ?"
    );
    const setFound = db.prepare(`
      UPDATE playlist_tracks SET
        status = 'found',
        video_id = ?,
        video_title = ?,
        channel_title = ?,
        thumbnail = ?,
        error_message = NULL
      WHERE id = ?
    `);
    const setError = db.prepare(
      "UPDATE playlist_tracks SET status = 'error', error_message = ? WHERE id = ?"
    );

    let updated = 0;
    let failed = 0;

    for (const row of pendingRows) {
      const trackId = row.id as string;
      const queries: string[] =
        typeof row.search_queries === "string"
          ? JSON.parse(row.search_queries)
          : (row.search_queries as string[] ?? []);

      // full-OST needs long compilation; individual tracks allow short videos
      const allowShortVideo = row.allow_full_ost === 0 || row.allow_full_ost === false;

      setSearching.run(trackId);

      try {
        const video = await findBestVideo(queries, allowShortVideo);

        if (video) {
          setFound.run(video.videoId, video.title, video.channelTitle, video.thumbnail, trackId);
          updated++;
        } else {
          setError.run("No suitable video found after trying all queries.", trackId);
          failed++;
        }
      } catch (err) {
        setError.run(
          err instanceof Error ? err.message : "YouTube search failed",
          trackId
        );
        failed++;
      }
    }

    const allRows = db.prepare(`
      SELECT pt.*, g.title AS game_title
      FROM playlist_tracks pt
      JOIN games g ON g.id = pt.game_id
      ORDER BY pt.position ASC
    `).all() as Array<Record<string, unknown>>;

    const tracks = allRows.map((row) => ({
      ...row,
      search_queries: row.search_queries
        ? JSON.parse(row.search_queries as string)
        : null,
    })) as PlaylistTrack[];

    return NextResponse.json({ updated, failed, tracks });
  } catch (err) {
    console.error("[POST /api/playlist/search]", err);
    return NextResponse.json(
      { error: "Search step failed", detail: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
