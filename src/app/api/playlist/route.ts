import { NextResponse } from "next/server";
import { Playlist } from "@/lib/db/repo";

export async function GET() {
  try {
    return NextResponse.json(Playlist.listAllWithGameTitle());
  } catch (err) {
    console.error("[GET /api/playlist]", err);
    return NextResponse.json({ error: "Failed to fetch playlist" }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    Playlist.clearAll();
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[DELETE /api/playlist]", err);
    return NextResponse.json({ error: "Failed to clear playlist" }, { status: 500 });
  }
}
