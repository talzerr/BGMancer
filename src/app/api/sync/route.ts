import { NextResponse } from "next/server";
import { auth } from "@/lib/services/auth";
import { Playlist, Config } from "@/lib/db/repo";
import {
  findBGMancerPlaylist,
  createBGMancerPlaylist,
  addVideoToPlaylist,
} from "@/lib/services/youtube";
import { runConcurrent } from "@/lib/concurrency";

const SYNC_CONCURRENCY = 4;

export async function POST() {
  try {
    const session = await auth();
    if (!session?.access_token) {
      return NextResponse.json(
        { error: "You must be signed in with Google to sync your playlist." },
        { status: 401 },
      );
    }

    const accessToken = session.access_token;
    const trackRows = Playlist.listUnsyncedFound();

    if (trackRows.length === 0) {
      const alreadySynced = Playlist.countSynced() > 0;
      return NextResponse.json({
        message: alreadySynced
          ? "All tracks are already synced."
          : "No tracks with videos ready to sync. Run 'Find Videos' first.",
        synced: 0,
        playlist_id: null,
      });
    }

    let playlistId = await findBGMancerPlaylist(accessToken);
    if (!playlistId) {
      playlistId = await createBGMancerPlaylist(accessToken);
    }

    Config.upsert("youtube_playlist_id", playlistId);

    const syncedIds: string[] = [];
    const errors: Array<{ track_id: string; error: string }> = [];

    await runConcurrent(trackRows, SYNC_CONCURRENCY, async (track) => {
      try {
        await addVideoToPlaylist(accessToken, playlistId, track.video_id);
        Playlist.markSynced(track.id);
        syncedIds.push(track.id);
      } catch (err) {
        errors.push({
          track_id: track.id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    });

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
      { status: 500 },
    );
  }
}
