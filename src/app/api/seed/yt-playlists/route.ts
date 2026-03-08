import { NextResponse } from "next/server";
import { YtPlaylists } from "@/lib/db/repo";

/**
 * GET /api/seed/yt-playlists
 *
 * Exports the current game_yt_playlists table as a JSON array keyed by game title.
 * Save the response as data/yt-playlists.json to persist discovered playlists across DB resets.
 */
export async function GET() {
  try {
    const entries = YtPlaylists.listAll();
    return NextResponse.json(entries, {
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
