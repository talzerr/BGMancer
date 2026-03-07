import { NextResponse } from "next/server";
import type { RowDataPacket, ResultSetHeader } from "mysql2";
import { getPool } from "@/lib/db";
import type { AddGamePayload, Game } from "@/types";

export async function GET() {
  try {
    const db = getPool();
    const [rows] = await db.query<RowDataPacket[]>(
      "SELECT * FROM games ORDER BY created_at DESC"
    );
    // mysql2 returns JSON columns already parsed; cast to Game[]
    return NextResponse.json(rows as Game[]);
  } catch (err) {
    console.error("[GET /api/games]", err);
    return NextResponse.json({ error: "Failed to fetch games" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body: AddGamePayload = await request.json();

    if (!body.title?.trim()) {
      return NextResponse.json({ error: "Game title is required" }, { status: 400 });
    }

    const validVibes = ["official_soundtrack", "boss_themes", "ambient_exploration"];
    if (!validVibes.includes(body.vibe_preference)) {
      return NextResponse.json({ error: "Invalid vibe preference" }, { status: 400 });
    }

    const db = getPool();
    const id = crypto.randomUUID();

    await db.query<ResultSetHeader>(
      "INSERT INTO games (id, title, vibe_preference, status) VALUES (?, ?, ?, 'pending')",
      [id, body.title.trim(), body.vibe_preference]
    );

    const [rows] = await db.query<RowDataPacket[]>(
      "SELECT * FROM games WHERE id = ?",
      [id]
    );
    return NextResponse.json(rows[0] as Game, { status: 201 });
  } catch (err) {
    console.error("[POST /api/games]", err);
    return NextResponse.json({ error: "Failed to add game" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Game ID is required" }, { status: 400 });
    }

    const db = getPool();
    await db.query<ResultSetHeader>("DELETE FROM games WHERE id = ?", [id]);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[DELETE /api/games]", err);
    return NextResponse.json({ error: "Failed to delete game" }, { status: 500 });
  }
}
