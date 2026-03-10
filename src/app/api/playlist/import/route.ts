import { NextResponse } from "next/server";
import { Games, Playlist, Users, Sessions } from "@/lib/db/repo";
import { YT_IMPORT_GAME_ID } from "@/lib/constants";
import { fetchPlaylistItems, YouTubeQuotaError } from "@/lib/services/youtube";
import { newId } from "@/lib/uuid";
import { TrackStatus } from "@/types";
import type { PlaylistTrack } from "@/types";

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
 * Replaces the existing playlist. Tracks are imported as status='found'.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const playlistId = extractPlaylistId(body.url ?? "");

    if (!playlistId) {
      return NextResponse.json(
        { error: "Invalid input — paste a YouTube playlist URL or a playlist ID." },
        { status: 400 },
      );
    }

    const tracks = await fetchPlaylistItems(playlistId);

    if (tracks.length === 0) {
      return NextResponse.json(
        { error: "No tracks found. The playlist may be private, empty, or the ID is incorrect." },
        { status: 404 },
      );
    }

    Games.ensureExists(YT_IMPORT_GAME_ID, "YouTube Import");

    const user = Users.getOrCreateDefault();
    const session = Sessions.create(user.id, `YouTube Import – ${new Date().toLocaleDateString()}`);

    const now = new Date().toISOString();
    const tracksToInsert = tracks.map((t) => ({
      id: newId(),
      game_id: YT_IMPORT_GAME_ID,
      track_name: t.title,
      video_id: t.videoId,
      video_title: t.title,
      channel_title: t.channelTitle,
      thumbnail: t.thumbnail,
      search_queries: null,
      duration_seconds: null,
      status: TrackStatus.Found,
      error_message: null,
    }));

    Playlist.replaceAll(session.id, tracksToInsert);

    // Construct the response in-memory — avoids a round-trip JOIN query.
    const result: PlaylistTrack[] = tracksToInsert.map((t, i) => ({
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
    });
  } catch (err) {
    if (err instanceof YouTubeQuotaError) {
      return NextResponse.json({ error: err.message }, { status: 429 });
    }
    console.error("[POST /api/playlist/import]", err);
    return NextResponse.json(
      { error: "Import failed", detail: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
