import { NextResponse } from "next/server";
import { Playlist } from "@/lib/db/repo";

/** DELETE /api/playlist/:id — Remove a single track from the playlist. */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await Playlist.removeOne(id);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[DELETE /api/playlist/[id]]", err);
    return NextResponse.json({ error: "Failed to remove track" }, { status: 500 });
  }
}
