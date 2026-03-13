import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";

export async function GET() {
  try {
    const rows = getDB()
      .prepare(
        "SELECT id AS game_id, title AS game_title, yt_playlist_id AS playlist_id FROM games WHERE yt_playlist_id IS NOT NULL ORDER BY title ASC",
      )
      .all();
    return NextResponse.json(rows);
  } catch (err) {
    console.error("[GET /api/dev/yt-playlists]", err);
    return NextResponse.json({ error: "Failed to load yt-playlists" }, { status: 500 });
  }
}
