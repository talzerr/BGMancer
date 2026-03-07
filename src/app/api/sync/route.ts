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

    // Load all found tracks ordered by position
    const [trackRows] = await db.query<RowDataPacket[]>(`
      SELECT id, video_id, position
      FROM playlist_tracks
      WHERE status = 'found' AND video_id IS NOT NULL
      ORDER BY position ASC
    `);

    if (trackRows.length === 0) {
      return NextResponse.json({
        message: "No tracks with videos ready to sync. Run 'Find Videos' first.",
        synced: 0,
        playlist_id: null,
      });
    }

    // Get or create the BGMancer Journey playlist
    let playlistId = await findBGMancerPlaylist(accessToken);
    if (!playlistId) {
      playlistId = await createBGMancerPlaylist(accessToken);
    }

    // Save playlist ID to config for future reference
    await db.query<ResultSetHeader>(
      "INSERT INTO config (`key`, value) VALUES ('youtube_playlist_id', ?) ON DUPLICATE KEY UPDATE value = ?",
      [playlistId, playlistId]
    );

    const syncedIds: string[] = [];
    const errors: Array<{ track_id: string; error: string }> = [];

    for (const track of trackRows) {
      try {
        await addVideoToPlaylist(accessToken, playlistId, track.video_id as string);
        syncedIds.push(track.id as string);
      } catch (err) {
        errors.push({
          track_id: track.id as string,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return NextResponse.json({
      message: `Synced ${syncedIds.length} track(s) to "BGMancer Journey".`,
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
