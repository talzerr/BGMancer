import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { YtPlaylists, Users } from "@/lib/db/repo";
import { getOrCreateUserId } from "@/lib/services/session";

/** GET /api/yt-cache — returns merged {game_id: playlist_id} for the current user. */
export async function GET() {
  try {
    const cookieStore = await cookies();
    const userId = await getOrCreateUserId(cookieStore);
    Users.getOrCreate(userId);

    return NextResponse.json(YtPlaylists.listAllAsMap(userId));
  } catch (err) {
    console.error("[GET /api/yt-cache]", err);
    return NextResponse.json({ error: "Failed to load playlist cache" }, { status: 500 });
  }
}

/** PUT /api/yt-cache — body: { game_id, playlist_id } — sets a personal override for the user. */
export async function PUT(request: Request) {
  try {
    const cookieStore = await cookies();
    const userId = await getOrCreateUserId(cookieStore);
    Users.getOrCreate(userId);

    const { game_id, playlist_id } = (await request.json()) as {
      game_id?: string;
      playlist_id?: string;
    };

    if (!game_id?.trim() || !playlist_id?.trim()) {
      return NextResponse.json({ error: "game_id and playlist_id are required" }, { status: 400 });
    }

    YtPlaylists.upsertForUser(game_id, userId, playlist_id);
    return NextResponse.json({ game_id, playlist_id });
  } catch (err) {
    console.error("[PUT /api/yt-cache]", err);
    return NextResponse.json({ error: "Failed to update playlist cache" }, { status: 500 });
  }
}

/** DELETE /api/yt-cache?game_id=... — clears the user's personal override (falls back to global). */
export async function DELETE(request: Request) {
  try {
    const cookieStore = await cookies();
    const userId = await getOrCreateUserId(cookieStore);

    const { searchParams } = new URL(request.url);
    const game_id = searchParams.get("game_id");

    if (!game_id) {
      return NextResponse.json({ error: "game_id is required" }, { status: 400 });
    }

    YtPlaylists.clearForUser(game_id, userId);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[DELETE /api/yt-cache]", err);
    return NextResponse.json({ error: "Failed to clear playlist cache" }, { status: 500 });
  }
}
