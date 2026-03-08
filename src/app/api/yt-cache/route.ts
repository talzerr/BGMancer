import { NextResponse } from "next/server";
import { YtPlaylists } from "@/lib/db/repo";

/** GET /api/yt-cache — returns { [game_id]: playlist_id } for all cached entries. */
export async function GET() {
  try {
    return NextResponse.json(YtPlaylists.listAllAsMap());
  } catch (err) {
    console.error("[GET /api/yt-cache]", err);
    return NextResponse.json({ error: "Failed to load playlist cache" }, { status: 500 });
  }
}

/** PUT /api/yt-cache — body: { game_id, playlist_id } — upserts a cached entry. */
export async function PUT(request: Request) {
  try {
    const { game_id, playlist_id } = (await request.json()) as {
      game_id?: string;
      playlist_id?: string;
    };

    if (!game_id?.trim() || !playlist_id?.trim()) {
      return NextResponse.json({ error: "game_id and playlist_id are required" }, { status: 400 });
    }

    YtPlaylists.upsert(game_id, playlist_id);
    return NextResponse.json({ game_id, playlist_id });
  } catch (err) {
    console.error("[PUT /api/yt-cache]", err);
    return NextResponse.json({ error: "Failed to update playlist cache" }, { status: 500 });
  }
}

/** DELETE /api/yt-cache?game_id=... — clears the cached entry for a game. */
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const game_id = searchParams.get("game_id");

    if (!game_id) {
      return NextResponse.json({ error: "game_id is required" }, { status: 400 });
    }

    YtPlaylists.clearForGame(game_id);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[DELETE /api/yt-cache]", err);
    return NextResponse.json({ error: "Failed to clear playlist cache" }, { status: 500 });
  }
}
