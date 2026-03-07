import { NextResponse } from "next/server";
import type { RowDataPacket, ResultSetHeader } from "mysql2";
import { getPool } from "@/lib/db";
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
 *
 * Returns the updated list of all tracks.
 */
export async function POST() {
  try {
    const db = getPool();

    // Load all pending tracks (joined with game for context)
    const [pendingRows] = await db.query<RowDataPacket[]>(`
      SELECT pt.*, g.allow_full_ost
      FROM playlist_tracks pt
      JOIN games g ON g.id = pt.game_id
      WHERE pt.status = 'pending'
      ORDER BY pt.position ASC
    `);

    if (pendingRows.length === 0) {
      return NextResponse.json({ message: "No pending tracks to search.", updated: 0 });
    }

    let updated = 0;
    let failed = 0;

    for (const row of pendingRows) {
      const trackId = row.id as string;
      const queries: string[] =
        typeof row.search_queries === "string"
          ? JSON.parse(row.search_queries)
          : (row.search_queries ?? []);

      // full-OST needs long compilation; individual tracks allow short videos
      const allowShortVideo = row.allow_full_ost === 0 || row.allow_full_ost === false;

      // Mark as searching
      await db.query<ResultSetHeader>(
        "UPDATE playlist_tracks SET status = 'searching' WHERE id = ?",
        [trackId]
      );

      try {
        const video = await findBestVideo(queries, allowShortVideo);

        if (video) {
          await db.query<ResultSetHeader>(
            `UPDATE playlist_tracks SET
              status = 'found',
              video_id = ?,
              video_title = ?,
              channel_title = ?,
              thumbnail = ?,
              error_message = NULL
             WHERE id = ?`,
            [video.videoId, video.title, video.channelTitle, video.thumbnail, trackId]
          );
          updated++;
        } else {
          await db.query<ResultSetHeader>(
            "UPDATE playlist_tracks SET status = 'error', error_message = ? WHERE id = ?",
            ["No suitable video found after trying all queries.", trackId]
          );
          failed++;
        }
      } catch (err) {
        await db.query<ResultSetHeader>(
          "UPDATE playlist_tracks SET status = 'error', error_message = ? WHERE id = ?",
          [err instanceof Error ? err.message : "YouTube search failed", trackId]
        );
        failed++;
      }
    }

    // Return updated playlist
    const [allRows] = await db.query<RowDataPacket[]>(`
      SELECT pt.*, g.title AS game_title
      FROM playlist_tracks pt
      JOIN games g ON g.id = pt.game_id
      ORDER BY pt.position ASC
    `);

    const tracks = allRows.map((row) => ({
      ...row,
      search_queries:
        typeof row.search_queries === "string"
          ? JSON.parse(row.search_queries)
          : row.search_queries,
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
