import { NextResponse } from "next/server";
import { Playlist, Games } from "@/lib/db/repo";
import { fetchPlaylistItems, fetchVideoDurations } from "@/lib/services/youtube";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const track = Playlist.getById(id);
  if (!track) {
    return NextResponse.json({ error: "Track not found" }, { status: 404 });
  }

  const game = Games.getById(track.game_id);
  if (!game) {
    return NextResponse.json({ error: "Game not found" }, { status: 404 });
  }

  const existingIds = new Set(Playlist.getVideoIdsForGame(track.game_id));
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

  const picked = candidates[Math.floor(Math.random() * candidates.length)];

  let durationSeconds: number | null = null;
  try {
    const durations = await fetchVideoDurations([picked.videoId]);
    durationSeconds = durations.get(picked.videoId) ?? null;
  } catch (err) {
    // Duration is optional — log but don't fail the reroll
    console.warn("[reroll] fetchVideoDurations failed (non-fatal):", err);
  }

  try {
    Playlist.setFound(
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

  const updated = Playlist.getById(id);
  return NextResponse.json({ track: updated });
}
