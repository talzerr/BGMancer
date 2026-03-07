import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import type { AddGamePayload, Game } from "@/types";

export async function GET() {
  try {
    const rows = getDB()
      .prepare("SELECT * FROM games ORDER BY created_at ASC")
      .all() as Game[];
    return NextResponse.json(rows);
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

    const db = getDB();
    const id = crypto.randomUUID();
    const allowFullOST = body.allow_full_ost ? 1 : 0;

    db.prepare(
      "INSERT INTO games (id, title, vibe_preference, allow_full_ost) VALUES (?, ?, ?, ?)"
    ).run(id, body.title.trim(), body.vibe_preference, allowFullOST);

    const row = db.prepare("SELECT * FROM games WHERE id = ?").get(id) as Game;
    return NextResponse.json(row, { status: 201 });
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
    const db = getDB();
    const setClauses: string[] = [];
    const values: unknown[] = [];

    if (typeof body.allow_full_ost === "boolean") {
      setClauses.push("allow_full_ost = ?");
      values.push(body.allow_full_ost ? 1 : 0);
    }
    if (typeof body.vibe_preference === "string") {
      setClauses.push("vibe_preference = ?");
      values.push(body.vibe_preference);
    }

    if (setClauses.length === 0) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
    }

    setClauses.push("updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')");
    values.push(id);

    db.prepare(`UPDATE games SET ${setClauses.join(", ")} WHERE id = ?`).run(...values);

    const row = db.prepare("SELECT * FROM games WHERE id = ?").get(id) as Game;
    return NextResponse.json(row);
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

    getDB().prepare("DELETE FROM games WHERE id = ?").run(id);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[DELETE /api/games]", err);
    return NextResponse.json({ error: "Failed to delete game" }, { status: 500 });
  }
}
