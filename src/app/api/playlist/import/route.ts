import { NextResponse } from "next/server";
import { Games, Playlist } from "@/lib/db/repo";
import { YT_IMPORT_GAME_ID } from "@/lib/constants";
import { fetchPlaylistItems, YouTubeQuotaError } from "@/lib/services/youtube";

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
        { status: 400 }
      );
    }

    const tracks = await fetchPlaylistItems(playlistId);

    if (tracks.length === 0) {
      return NextResponse.json(
        { error: "No tracks found. The playlist may be private, empty, or the ID is incorrect." },
        { status: 404 }
      );
    }

    Games.ensureExists(YT_IMPORT_GAME_ID, "YouTube Import", "official_soundtrack");

    Playlist.replaceAll(
      tracks.map((t, i) => ({
        id: crypto.randomUUID(),
        game_id: YT_IMPORT_GAME_ID,
        track_name: t.title,
        video_id: t.videoId,
        video_title: t.title,
        channel_title: t.channelTitle,
        thumbnail: t.thumbnail,
        search_queries: null,
        status: "found" as const,
        error_message: null,
      })),
    );

    const result = Playlist.listAllWithGameTitle();

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
      { status: 500 }
    );
  }
}
