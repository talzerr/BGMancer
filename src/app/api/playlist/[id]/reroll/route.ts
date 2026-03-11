import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { Playlist, Games, YtPlaylists, TrackTags } from "@/lib/db/repo";
import { getOrCreateUserId } from "@/lib/services/session";
import { fetchPlaylistItems, fetchVideoDurations } from "@/lib/services/youtube";
import { tagGameTracks } from "@/lib/pipeline/tagger";
import { getLocalLLMProvider } from "@/lib/llm";

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

  // Exclude video IDs already used by other tracks for this game
  const existingIds = new Set(Playlist.getVideoIdsForGame(track.game_id));
  existingIds.delete(track.video_id ?? "");

  // Try cached tags first — zero LLM calls
  const cachedTags = TrackTags.getByGame(track.game_id);
  const nonJunkCached = cachedTags.filter((t) => !t.isJunk && !existingIds.has(t.videoId));

  if (nonJunkCached.length > 0) {
    const picked = nonJunkCached[Math.floor(Math.random() * nonJunkCached.length)];

    let durationSeconds: number | null = null;
    try {
      const durations = await fetchVideoDurations([picked.videoId]);
      durationSeconds = durations.get(picked.videoId) ?? null;
    } catch {
      // Duration is optional
    }

    try {
      Playlist.setFound(
        id,
        picked.videoId,
        picked.videoId, // video_title — will be overridden by cleanName in track_name
        "", // channel_title not in tag cache; optional field
        "", // thumbnail not in tag cache; optional field
        durationSeconds,
        picked.cleanName,
      );
    } catch (err) {
      console.error("[reroll] setFound failed:", err);
      return NextResponse.json({ error: "Failed to update track" }, { status: 500 });
    }

    const updated = Playlist.getById(id);
    return NextResponse.json({ track: updated });
  }

  // No cached tags — fall back to fetching playlist and tagging
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

  const candidates = allItems.filter((item) => !existingIds.has(item.videoId));

  if (candidates.length === 0) {
    return NextResponse.json(
      { error: "No alternative tracks available — all playlist videos are already in use" },
      { status: 409 },
    );
  }

  // Tag the candidates (will cache for future rerolls)
  let taggedTracks;
  try {
    const provider = getLocalLLMProvider();
    taggedTracks = await tagGameTracks(game.id, game.title, candidates, provider);
  } catch {
    // Fall back to random pick without tagging
    taggedTracks = candidates.map((c) => ({
      videoId: c.videoId,
      title: c.title,
      channelTitle: c.channelTitle,
      thumbnail: c.thumbnail,
      gameId: game.id,
      gameTitle: game.title,
      cleanName: c.title,
      energy: 2 as const,
      role: "ambient" as const,
      isJunk: false,
    }));
  }

  const nonJunk = taggedTracks.filter((t) => !t.isJunk);
  if (nonJunk.length === 0) {
    return NextResponse.json({ error: "No suitable alternative tracks found" }, { status: 409 });
  }

  const picked = nonJunk[Math.floor(Math.random() * nonJunk.length)];

  let durationSeconds: number | null = null;
  try {
    const durations = await fetchVideoDurations([picked.videoId]);
    durationSeconds = durations.get(picked.videoId) ?? null;
  } catch {
    // Duration is optional
  }

  try {
    Playlist.setFound(
      id,
      picked.videoId,
      picked.title,
      picked.channelTitle,
      picked.thumbnail,
      durationSeconds,
      picked.cleanName,
    );
  } catch (err) {
    console.error("[reroll] setFound failed:", err);
    return NextResponse.json({ error: "Failed to update track" }, { status: 500 });
  }

  const updated = Playlist.getById(id);
  return NextResponse.json({ track: updated });
}
