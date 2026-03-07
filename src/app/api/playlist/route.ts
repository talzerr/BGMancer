import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import type { PlaylistTrack } from "@/types";

export async function GET() {
  try {
    const rows = getDB().prepare(`
      SELECT pt.*, g.title AS game_title
      FROM playlist_tracks pt
      JOIN games g ON g.id = pt.game_id
      ORDER BY pt.position ASC
    `).all() as Record<string, unknown>[];

    const tracks = rows.map((row) => ({
      ...row,
      search_queries: row.search_queries
        ? JSON.parse(row.search_queries as string)
        : null,
    })) as PlaylistTrack[];

    return NextResponse.json(tracks);
  } catch (err) {
    console.error("[GET /api/playlist]", err);
    return NextResponse.json({ error: "Failed to fetch playlist" }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    getDB().prepare("DELETE FROM playlist_tracks").run();
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[DELETE /api/playlist]", err);
    return NextResponse.json({ error: "Failed to clear playlist" }, { status: 500 });
  }
}
