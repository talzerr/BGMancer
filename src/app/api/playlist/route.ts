import { NextResponse } from "next/server";
import type { RowDataPacket, ResultSetHeader } from "mysql2";
import { getPool } from "@/lib/db";
import type { PlaylistTrack } from "@/types";

export async function GET() {
  try {
    const db = getPool();
    // JOIN with games to include game_title in each track
    const [rows] = await db.query<RowDataPacket[]>(`
      SELECT
        pt.*,
        g.title AS game_title
      FROM playlist_tracks pt
      JOIN games g ON g.id = pt.game_id
      ORDER BY pt.position ASC
    `);

    const tracks = rows.map((row) => ({
      ...row,
      search_queries: row.search_queries
        ? typeof row.search_queries === "string"
          ? JSON.parse(row.search_queries)
          : row.search_queries
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
    const db = getPool();
    await db.query<ResultSetHeader>("DELETE FROM playlist_tracks");
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[DELETE /api/playlist]", err);
    return NextResponse.json({ error: "Failed to clear playlist" }, { status: 500 });
  }
}
