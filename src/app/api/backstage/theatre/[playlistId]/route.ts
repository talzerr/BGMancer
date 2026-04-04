import { Sessions, Playlist, DirectorDecisions } from "@/lib/db/repo";
import { NextResponse } from "next/server";
import { createLogger } from "@/lib/logger";

const log = createLogger("backstage-theatre");

/** GET /api/backstage/theatre/[playlistId] — full telemetry for a playlist */
export async function GET(_req: Request, { params }: { params: Promise<{ playlistId: string }> }) {
  try {
    const { playlistId } = await params;
    const session = await Sessions.getByIdWithTelemetry(playlistId);
    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const tracks = await Playlist.listAllWithGameTitle(session.user_id, playlistId);
    const decisions = await DirectorDecisions.listByPlaylist(playlistId);

    return NextResponse.json({
      session: {
        id: session.id,
        name: session.name,
        created_at: session.created_at,
      },
      tracks,
      decisions,
      gameBudgets: session.gameBudgets,
      rubric: session.rubric,
    });
  } catch (err) {
    log.error("handler failed", {}, err);
    return NextResponse.json({ error: "Failed to load session telemetry" }, { status: 500 });
  }
}
