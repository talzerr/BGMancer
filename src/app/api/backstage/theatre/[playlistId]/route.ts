import { Sessions, Playlist, DirectorDecisions } from "@/lib/db/repo";
import { NextResponse } from "next/server";

/** GET /api/backstage/theatre/[playlistId] — full telemetry for a playlist */
export async function GET(_req: Request, { params }: { params: Promise<{ playlistId: string }> }) {
  const { playlistId } = await params;
  const session = Sessions.getByIdWithTelemetry(playlistId);
  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const tracks = Playlist.listAllWithGameTitle(session.user_id, playlistId);
  const decisions = DirectorDecisions.listByPlaylist(playlistId);

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
}
