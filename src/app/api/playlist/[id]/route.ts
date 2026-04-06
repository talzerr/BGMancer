import { NextResponse } from "next/server";
import { Playlist } from "@/lib/db/repo";
import { withRequiredAuth } from "@/lib/services/auth/route-wrappers";

/** DELETE /api/playlist/:id — Remove a single track from the playlist. */
export const DELETE = withRequiredAuth(
  async (userId, _req: Request, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;

    const ownerId = await Playlist.getTrackOwnerId(id);
    if (!ownerId) {
      return NextResponse.json({ error: "Track not found" }, { status: 404 });
    }
    if (ownerId !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await Playlist.removeOne(id);
    return NextResponse.json({ success: true });
  },
  "DELETE /api/playlist/[id]",
);
