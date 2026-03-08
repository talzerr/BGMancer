import { NextResponse } from "next/server";
import { YtPlaylists } from "@/lib/db/repo";

/**
 * GET /api/seed/yt-playlists
 *
 * Returns the current game_yt_playlists table as a seed-compatible JSON array.
 * Copy the response body into yt-playlists.seed.json at the project root to
 * persist discovered playlists across DB resets.
 */
export async function GET() {
  try {
    const entries = YtPlaylists.listAll();
    return NextResponse.json(entries, {
      headers: {
        "Content-Disposition": 'attachment; filename="yt-playlists.seed.json"',
      },
    });
  } catch (err) {
    console.error("[GET /api/seed/yt-playlists]", err);
    return NextResponse.json({ error: "Failed to export seed" }, { status: 500 });
  }
}
