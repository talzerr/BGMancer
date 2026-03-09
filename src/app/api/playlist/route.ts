import type { NextRequest } from "next/server";
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

export async function PATCH(req: NextRequest) {
  try {
    const { orderedIds } = (await req.json()) as { orderedIds: string[] };
    if (!Array.isArray(orderedIds)) {
      return NextResponse.json({ error: "orderedIds must be an array" }, { status: 400 });
    }
    Playlist.reorder(orderedIds);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[PATCH /api/playlist]", err);
    return NextResponse.json({ error: "Failed to reorder playlist" }, { status: 500 });
  }
}
