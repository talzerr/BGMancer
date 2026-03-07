import { NextResponse } from "next/server";
import type { RowDataPacket, ResultSetHeader } from "mysql2";
import { auth } from "@/lib/auth";
import { getPool } from "@/lib/db";
import {
  findBGMancerPlaylist,
  createBGMancerPlaylist,
  addVideoToPlaylist,
} from "@/lib/youtube";

export async function POST() {
  try {
    const session = await auth();
    if (!session?.access_token) {
      return NextResponse.json(
        { error: "You must be signed in with Google to sync your playlist." },
        { status: 401 }
      );
    }

    const accessToken = session.access_token;
    const db = getPool();

    // Fetch all games that have a video (found or already synced)
    const [rows] = await db.query<RowDataPacket[]>(
      "SELECT id, title, current_video_id, status FROM games WHERE status IN ('found', 'synced') AND current_video_id IS NOT NULL"
    );

    if (!rows.length) {
      return NextResponse.json({
        message: "No games with videos ready to sync.",
        synced: 0,
        playlist_id: null,
      });
    }

    // Get or create the BGMancer Journey playlist
    let playlistId = await findBGMancerPlaylist(accessToken);
    if (!playlistId) {
      playlistId = await createBGMancerPlaylist(accessToken);
    }

    // Only push games not yet synced
    const toSync = rows.filter((g) => g.status === "found");
    const syncedIds: string[] = [];
    const errors: Array<{ game_id: string; error: string }> = [];

    for (const game of toSync) {
      try {
        await addVideoToPlaylist(accessToken, playlistId, game.current_video_id as string);
        syncedIds.push(game.id as string);
      } catch (err) {
        errors.push({
          game_id: game.id as string,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    // Mark synced games in DB
    if (syncedIds.length > 0) {
      const placeholders = syncedIds.map(() => "?").join(", ");
      await db.query<ResultSetHeader>(
        `UPDATE games SET status = 'synced' WHERE id IN (${placeholders})`,
        syncedIds
      );
    }

    return NextResponse.json({
      message: `Synced ${syncedIds.length} game(s) to "BGMancer Journey".`,
      synced: syncedIds.length,
      errors: errors.length > 0 ? errors : undefined,
      playlist_id: playlistId,
      playlist_url: `https://www.youtube.com/playlist?list=${playlistId}`,
    });
  } catch (err) {
    console.error("[POST /api/sync]", err);
    return NextResponse.json(
      { error: "Sync failed", detail: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
