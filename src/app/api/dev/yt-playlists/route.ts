import { NextResponse } from "next/server";
import { YtPlaylists } from "@/lib/db/repo";

export async function GET() {
  try {
    return NextResponse.json(YtPlaylists.loadRaw());
  } catch (err) {
    console.error("[GET /api/dev/yt-playlists]", err);
    return NextResponse.json({ error: "Failed to load yt-playlists" }, { status: 500 });
  }
}
