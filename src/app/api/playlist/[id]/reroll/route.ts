import { NextResponse } from "next/server";
import { Playlist, Games } from "@/lib/db/repo";
import { MIN_TRACK_DURATION_SECONDS, MAX_TRACK_DURATION_SECONDS } from "@/lib/constants";
import { withRequiredAuth } from "@/lib/services/auth/route-wrappers";
import { rerollSchema, zodErrorResponse } from "@/lib/validation";
import { getTaggedPool } from "@/lib/pipeline/generation/candidates";

/** POST /api/playlist/:id/reroll — Replace a track with a different one from the same game's curated pool. */
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

    const pool = await getTaggedPool(game.id, game.title);

    // Exclude video IDs already in this session, but allow the current track's slot to be reused
    const sessionVideoIds = new Set(await Playlist.getVideoIdsForSession(track.playlist_id));
    sessionVideoIds.delete(track.video_id ?? "");

    const eligible = pool.filter((t) => {
      if (sessionVideoIds.has(t.videoId)) return false;
      if (!allowShortTracks && t.durationSeconds < MIN_TRACK_DURATION_SECONDS) return false;
      if (!allowLongTracks && t.durationSeconds > MAX_TRACK_DURATION_SECONDS) return false;
      return true;
    });

    if (eligible.length === 0) {
      return NextResponse.json(
        { error: "No alternative tracks available for this game" },
        { status: 409 },
      );
    }

    const picked = eligible[Math.floor(Math.random() * eligible.length)];

    await Playlist.updateVideo(
      id,
      picked.videoId,
      picked.title,
      null,
      null,
      picked.durationSeconds,
      picked.title,
    );

    const updated = await Playlist.getById(id);
    return NextResponse.json({ track: updated });
  },
  "POST /api/playlist/[id]/reroll",
);
