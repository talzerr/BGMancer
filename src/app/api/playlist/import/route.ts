import { NextResponse } from "next/server";
import { Games, Playlist, Sessions } from "@/lib/db/repo";
import { createLogger } from "@/lib/logger";
import { YT_IMPORT_GAME_ID, YT_IMPORT_MAX_TRACKS } from "@/lib/constants";
import {
  fetchPlaylistItems,
  fetchPlaylistMetadata,
  YouTubeQuotaError,
} from "@/lib/services/youtube";
import { newId } from "@/lib/uuid";
import type { PlaylistTrack } from "@/types";
import { getAuthUserId } from "@/lib/services/auth-helpers";
import { importPlaylistSchema, zodErrorResponse } from "@/lib/validation";
import { checkGuestRateLimit } from "@/lib/rate-limit";

const log = createLogger("import");

function extractPlaylistId(input: string): string | null {
  const trimmed = input.trim();
  try {
    const url = new URL(trimmed);
    const list = url.searchParams.get("list");
    if (list) return list;
  } catch {
    if (/^[A-Za-z0-9_-]{10,}$/.test(trimmed)) return trimmed;
  }
  return null;
}

/**
 * POST /api/playlist/import
 *
 * Imports all tracks from a YouTube playlist by URL or ID.
 * Authenticated: creates a session and persists tracks.
 * Guest: returns tracks without persistence.
 */
export async function POST(request: Request) {
  try {
    const userId = await getAuthUserId();

    // Rate-limit guests to protect YouTube API quota
    if (!userId) {
      const limited = await checkGuestRateLimit(request);
      if (limited) {
        return NextResponse.json(
          { error: `Please wait ${limited.waitSec}s before trying again.` },
          { status: 429, headers: { "Retry-After": String(limited.waitSec) } },
        );
      }
    }

    const parsed = importPlaylistSchema.safeParse(await request.json());
    if (!parsed.success) return zodErrorResponse(parsed.error);

    const playlistId = extractPlaylistId(parsed.data.url);

    if (!playlistId) {
      return NextResponse.json(
        { error: "Invalid input — paste a YouTube playlist URL or a playlist ID." },
        { status: 400 },
      );
    }

    let tracks;
    try {
      tracks = await fetchPlaylistItems(playlistId, YT_IMPORT_MAX_TRACKS);
    } catch (err) {
      if (err instanceof YouTubeQuotaError) {
        return NextResponse.json({ error: err.message }, { status: 429 });
      }
      throw err;
    }

    if (tracks.length === 0) {
      return NextResponse.json(
        { error: "No tracks found. The playlist may be private, empty, or the ID is incorrect." },
        { status: 404 },
      );
    }

    const metadata = await fetchPlaylistMetadata(playlistId);
    const playlistTitle = metadata?.title ?? `YouTube Playlist (${playlistId.slice(0, 6)})`;
    const now = new Date().toISOString();

    const baseTracks = tracks.map((t) => ({
      id: newId(),
      game_id: YT_IMPORT_GAME_ID,
      track_name: t.title,
      video_id: t.videoId,
      video_title: t.title,
      channel_title: t.channelTitle,
      thumbnail: t.thumbnail,
      duration_seconds: null,
    }));

    if (userId) {
      // Authenticated: persist to DB
      const sessionName = `YouTube: ${playlistTitle}`;
      await Games.ensureExists(userId, YT_IMPORT_GAME_ID, "YouTube Import");
      const session = await Sessions.create(userId, sessionName);
      await Playlist.replaceAll(session.id, baseTracks);

      const result: PlaylistTrack[] = baseTracks.map((t, i) => ({
        ...t,
        playlist_id: session.id,
        game_title: "YouTube Import",
        position: i,
        created_at: now,
        synced_at: null,
      }));

      return NextResponse.json({
        tracks: result,
        count: result.length,
        playlistId,
        sessionId: session.id,
      });
    }

    // Guest: return tracks without persistence
    const result: PlaylistTrack[] = baseTracks.map((t, i) => ({
      ...t,
      playlist_id: "guest",
      game_title: "YouTube Import",
      position: i,
      created_at: now,
      synced_at: null,
    }));

    return NextResponse.json({
      tracks: result,
      count: result.length,
      playlistId,
    });
  } catch (err) {
    log.error("handler failed", {}, err);
    return NextResponse.json(
      { error: "Import failed", detail: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
