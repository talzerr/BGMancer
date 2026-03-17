import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";

/**
 * GET /api/seed/yt-playlists
 *
 * Exports the current yt_playlist_id values from the games table as a JSON array
 * keyed by game title. Save the response as data/yt-playlists.json to persist
 * discovered playlists across DB resets.
 */
export async function GET() {
  try {
    const rows = getDB()
      .prepare(
        "SELECT title AS game_title, yt_playlist_id AS playlist_id FROM games WHERE yt_playlist_id IS NOT NULL ORDER BY title ASC",
      )
      .all() as Array<{ game_title: string; playlist_id: string }>;
    return NextResponse.json(rows, {
      headers: {
        "Content-Disposition": 'attachment; filename="yt-playlists.json"',
        "Content-Type": "application/json",
      },
    });
  } catch (err) {
    console.error("[GET /api/seed/yt-playlists]", err);
    return NextResponse.json({ error: "Failed to export seed" }, { status: 500 });
  }
}
