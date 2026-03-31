import { NextResponse } from "next/server";
import { Playlist, Games } from "@/lib/db/repo";
import {
  fetchPlaylistItems,
  fetchVideoMetadata,
  YouTubeQuotaError,
  YouTubeInvalidKeyError,
} from "@/lib/services/youtube";
import { MIN_TRACK_DURATION_SECONDS, MAX_TRACK_DURATION_SECONDS } from "@/lib/constants";

/** POST /api/playlist/:id/reroll — Replace a track with a different one from the same game's YouTube playlist. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let allowLongTracks = false;
  let allowShortTracks = false;
  try {
    const body = await req.json();
    allowLongTracks = body.allowLongTracks === true;
    allowShortTracks = body.allowShortTracks === true;
  } catch {
    // empty body — use defaults
  }

  const track = await Playlist.getById(id);
  if (!track) {
    return NextResponse.json({ error: "Track not found" }, { status: 404 });
  }

  const game = await Games.getById(track.game_id);
  if (!game) {
    return NextResponse.json({ error: "Game not found" }, { status: 404 });
  }

  const existingIds = new Set(await Playlist.getVideoIdsForGame(track.game_id));
  existingIds.delete(track.video_id ?? "");

  const ytPlaylistId = game.yt_playlist_id;
  if (!ytPlaylistId) {
    return NextResponse.json(
      {
        error:
          "No YouTube playlist cached for this game. Try regenerating the playlist from scratch.",
      },
      { status: 409 },
    );
  }

  let allItems;
  try {
    allItems = await fetchPlaylistItems(ytPlaylistId);
  } catch (err) {
    console.error("[reroll] fetchPlaylistItems failed:", err);
    return NextResponse.json({ error: "Failed to fetch YouTube playlist" }, { status: 502 });
  }

  const candidates = allItems.filter((item) => !existingIds.has(item.videoId));
  if (candidates.length === 0) {
    return NextResponse.json(
      { error: "No alternative tracks available — all playlist videos are already in use" },
      { status: 409 },
    );
  }

  // Fetch durations for all candidates so we can filter by length constraints
  const durations = new Map<string, number>();
  try {
    const meta = await fetchVideoMetadata(candidates.map((c) => c.videoId));
    for (const [id, m] of meta) durations.set(id, m.durationSeconds);
  } catch (err) {
    if (err instanceof YouTubeQuotaError || err instanceof YouTubeInvalidKeyError) {
      console.error("[reroll] fetchVideoMetadata fatal error:", err);
      return NextResponse.json({ error: (err as Error).message }, { status: 503 });
    }
    console.warn(
      "[reroll] fetchVideoMetadata failed (non-fatal), proceeding without durations:",
      err,
    );
  }

  const eligible = candidates.filter((item) => {
    const secs = durations.get(item.videoId);
    if (secs == null) return true; // duration unknown — allow through
    if (!allowShortTracks && secs < MIN_TRACK_DURATION_SECONDS) return false;
    if (!allowLongTracks && secs > MAX_TRACK_DURATION_SECONDS) return false;
    return true;
  });

  if (eligible.length === 0) {
    return NextResponse.json(
      { error: "No alternative tracks match your current duration settings" },
      { status: 409 },
    );
  }

  const picked = eligible[Math.floor(Math.random() * eligible.length)];
  const durationSeconds = durations.get(picked.videoId) ?? null;

  try {
    await Playlist.setFound(
      id,
      picked.videoId,
      picked.title,
      picked.channelTitle,
      picked.thumbnail,
      durationSeconds,
      picked.title,
    );
  } catch (err) {
    console.error("[reroll] setFound failed:", err);
    return NextResponse.json({ error: "Failed to update track" }, { status: 500 });
  }

  const updated = await Playlist.getById(id);
  return NextResponse.json({ track: updated });
}
