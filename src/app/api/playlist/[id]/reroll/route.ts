import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { Playlist, Games, YtPlaylists } from "@/lib/db/repo";
import { getOrCreateUserId } from "@/lib/services/session";
import { fetchPlaylistItems, fetchVideoDurations } from "@/lib/services/youtube";
import { selectTracksFromList, cleanTrackNames } from "@/lib/services/curation";
import { getLocalLLMProvider, getCleaningProvider } from "@/lib/llm";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const cookieStore = await cookies();
  const userId = await getOrCreateUserId(cookieStore);

  const { id } = await params;

  const track = Playlist.getById(id);
  if (!track) {
    return NextResponse.json({ error: "Track not found" }, { status: 404 });
  }

  const game = Games.getById(track.game_id);
  if (!game) {
    return NextResponse.json({ error: "Game not found" }, { status: 404 });
  }

  const ytPlaylistId = YtPlaylists.get(track.game_id, userId, game.title);
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

  if (allItems.length === 0) {
    return NextResponse.json({ error: "YouTube playlist is empty" }, { status: 409 });
  }

  // Exclude video IDs already used by other tracks for this game
  const existingIds = new Set(Playlist.getVideoIdsForGame(track.game_id));
  // Allow the current track's video to be picked again only if there are no alternatives
  existingIds.delete(track.video_id ?? "");
  const candidates = allItems.filter((item) => !existingIds.has(item.videoId));

  if (candidates.length === 0) {
    return NextResponse.json(
      { error: "No alternative tracks available — all playlist videos are already in use" },
      { status: 409 },
    );
  }

  let pickedIndex = Math.floor(Math.random() * candidates.length);
  try {
    const provider = getLocalLLMProvider();
    const indices = await selectTracksFromList(game.title, candidates, 1, provider);
    if (indices.length > 0 && indices[0] < candidates.length) {
      pickedIndex = indices[0];
    }
  } catch {
    // Fall back to random pick if LLM fails
  }

  const picked = candidates[pickedIndex];

  let durationSeconds: number | null = null;
  try {
    const durations = await fetchVideoDurations([picked.videoId]);
    durationSeconds = durations.get(picked.videoId) ?? null;
  } catch {
    // Duration is optional — proceed without it
  }

  // Clean the new track's display name so the card reflects the reroll visually.
  let trackName: string | null = null;
  try {
    const cleanedNames = await cleanTrackNames(
      [{ id, gameTitle: game.title, videoTitle: picked.title }],
      getCleaningProvider(),
    );
    trackName = cleanedNames.get(id) ?? null;
  } catch {
    // Name cleaning is optional — fall back to raw video title
  }

  try {
    Playlist.setFound(
      id,
      picked.videoId,
      picked.title,
      picked.channelTitle,
      picked.thumbnail,
      durationSeconds,
      trackName,
    );
  } catch (err) {
    console.error("[reroll] setFound failed:", err);
    return NextResponse.json({ error: "Failed to update track" }, { status: 500 });
  }

  const updated = Playlist.getById(id);
  return NextResponse.json({ track: updated });
}
