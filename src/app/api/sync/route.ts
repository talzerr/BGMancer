import { NextResponse } from "next/server";
import { auth } from "@/lib/services/auth";
import { Playlist } from "@/lib/db/repo";
import { createLogger } from "@/lib/logger";
import {
  findBGMancerPlaylist,
  createBGMancerPlaylist,
  addVideoToPlaylist,
} from "@/lib/services/youtube";
import { runConcurrent } from "@/lib/concurrency";

const log = createLogger("sync");

const SYNC_CONCURRENCY = 4;

/**
 * POST /api/sync
 *
 * Syncs all unsynced found tracks to a YouTube playlist ("BGMancer Journey").
 * Requires the user to be signed in with Google (OAuth access token via NextAuth).
 * Creates the YouTube playlist if it doesn't exist yet.
 *
 * Does not use withRequiredAuth because it needs the full NextAuth session
 * (OAuth access_token) — not just the userId.
 */
export async function POST() {
  try {
    const session = await auth();
    if (!session?.user?.id || !session.access_token) {
      return NextResponse.json(
        { error: "You must be signed in with Google to sync your playlist." },
        { status: 401 },
      );
    }

    const userId = session.user.id;
    const accessToken = session.access_token;
    const trackRows = await Playlist.listUnsyncedFound(userId);

    if (trackRows.length === 0) {
      const alreadySynced = (await Playlist.countSynced(userId)) > 0;
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

    const syncedIds: string[] = [];
    const errors: Array<{ track_id: string; error: string }> = [];

    await runConcurrent(trackRows, SYNC_CONCURRENCY, async (track) => {
      try {
        await addVideoToPlaylist(accessToken, playlistId, track.video_id);
        await Playlist.markSynced(track.id);
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
    // YouTube 403 means the token lacks playlist scope — prompt re-auth
    if (err instanceof Error && err.message.includes("403")) {
      return NextResponse.json(
        { error: "YouTube access not granted. Please re-authenticate with YouTube permissions." },
        { status: 401 },
      );
    }
    log.error("handler failed", {}, err);
    return NextResponse.json({ error: "Sync failed. Please try again." }, { status: 500 });
  }
}
