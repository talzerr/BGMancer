import { NextResponse } from "next/server";
import { Playlist, Games } from "@/lib/db/repo";
import {
  fetchPlaylistItems,
  fetchVideoMetadata,
  YouTubeQuotaError,
  YouTubeInvalidKeyError,
} from "@/lib/services/youtube";
import { MIN_TRACK_DURATION_SECONDS, MAX_TRACK_DURATION_SECONDS } from "@/lib/constants";
import { withRequiredAuth } from "@/lib/services/route-wrappers";
import { rerollSchema, zodErrorResponse } from "@/lib/validation";
import { createLogger } from "@/lib/logger";

const log = createLogger("reroll");

/** POST /api/playlist/:id/reroll — Replace a track with a different one from the same game's YouTube playlist. */
export const POST = withRequiredAuth(
  async (userId, req: Request, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;

    let body: Record<string, unknown> = {};
    try {
      body = await req.json();
    } catch {
      // empty body — use defaults
    }

    const parsed = rerollSchema.safeParse(body);
    if (!parsed.success) return zodErrorResponse(parsed.error);
    const { allowLongTracks = false, allowShortTracks = false } = parsed.data;

    const ownerId = await Playlist.getTrackOwnerId(id);
    if (!ownerId) {
      return NextResponse.json({ error: "Track not found" }, { status: 404 });
    }
    if (ownerId !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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
      log.error("fetchPlaylistItems failed", {}, err);
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
      for (const [vid, m] of meta) durations.set(vid, m.durationSeconds);
    } catch (err) {
      if (err instanceof YouTubeQuotaError || err instanceof YouTubeInvalidKeyError) {
        log.error("fetchVideoMetadata fatal error", {}, err);
        return NextResponse.json({ error: (err as Error).message }, { status: 503 });
      }
      log.error("fetchVideoMetadata failed (non-fatal), proceeding without durations", {}, err);
    }

    const eligible = candidates.filter((item) => {
      const secs = durations.get(item.videoId);
      if (secs == null) return true;
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

    await Playlist.setFound(
      id,
      picked.videoId,
      picked.title,
      picked.channelTitle,
      picked.thumbnail,
      durationSeconds,
      picked.title,
    );

    const updated = await Playlist.getById(id);
    return NextResponse.json({ track: updated });
  },
  "POST /api/playlist/[id]/reroll",
);
