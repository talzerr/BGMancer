import { NextResponse } from "next/server";
import type { RowDataPacket, ResultSetHeader } from "mysql2";
import { getPool } from "@/lib/db";
import type { AddGamePayload, Game } from "@/types";

export async function GET() {
  try {
    const db = getPool();
    const [rows] = await db.query<RowDataPacket[]>(
      "SELECT * FROM games ORDER BY created_at ASC"
    );
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
    const allowFullOST = body.allow_full_ost ?? false;

    await db.query<ResultSetHeader>(
      "INSERT INTO games (id, title, vibe_preference, allow_full_ost) VALUES (?, ?, ?, ?)",
      [id, body.title.trim(), body.vibe_preference, allowFullOST]
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

export async function PATCH(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Game ID is required" }, { status: 400 });
    }

    const body = await request.json();
    const db = getPool();

    // Only allow patching safe fields
    const updates: string[] = [];
    const values: unknown[] = [];

    if (typeof body.allow_full_ost === "boolean") {
      updates.push("allow_full_ost = ?");
      values.push(body.allow_full_ost);
    }
    if (typeof body.vibe_preference === "string") {
      updates.push("vibe_preference = ?");
      values.push(body.vibe_preference);
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
    }

    values.push(id);
    await db.query<ResultSetHeader>(
      `UPDATE games SET ${updates.join(", ")} WHERE id = ?`,
      values
    );

    const [rows] = await db.query<RowDataPacket[]>(
      "SELECT * FROM games WHERE id = ?",
      [id]
    );
    return NextResponse.json(rows[0] as Game);
  } catch (err) {
    console.error("[PATCH /api/games]", err);
    return NextResponse.json({ error: "Failed to update game" }, { status: 500 });
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
