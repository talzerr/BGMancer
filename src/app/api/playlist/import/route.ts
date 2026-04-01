import { NextResponse } from "next/server";
import { Games, Playlist, Sessions } from "@/lib/db/repo";
import { YT_IMPORT_GAME_ID, YT_IMPORT_MAX_TRACKS } from "@/lib/constants";
import {
  fetchPlaylistItems,
  fetchPlaylistMetadata,
  YouTubeQuotaError,
} from "@/lib/services/youtube";
import { newId } from "@/lib/uuid";
import { TrackStatus } from "@/types";
import type { PlaylistTrack } from "@/types";
import { withRequiredAuth } from "@/lib/services/route-wrappers";

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
 * Creates a new session (does not replace existing playlist).
 * Tracks are imported as status='found'.
 */
export const POST = withRequiredAuth(async (userId, request: Request) => {
  const body = await request.json();
  const playlistId = extractPlaylistId(body.url ?? "");

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

  // Fetch playlist metadata to get the actual title
  const metadata = await fetchPlaylistMetadata(playlistId);
  const playlistTitle = metadata?.title ?? `YouTube Playlist (${playlistId.slice(0, 6)})`;
  const sessionName = `YouTube: ${playlistTitle}`;

  await Games.ensureExists(userId, YT_IMPORT_GAME_ID, "YouTube Import");

  const session = await Sessions.create(userId, sessionName);

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

  await Playlist.replaceAll(session.id, tracksToInsert);

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
    sessionId: session.id,
  });
}, "POST /api/playlist/import");
