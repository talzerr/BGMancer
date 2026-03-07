import { NextResponse } from "next/server";
import type { RowDataPacket, ResultSetHeader } from "mysql2";
import { getPool } from "@/lib/db";
import type { AppConfig } from "@/types";

async function loadConfig(): Promise<AppConfig> {
  const db = getPool();
  const [rows] = await db.query<RowDataPacket[]>("SELECT `key`, value FROM config");
  const map = Object.fromEntries(rows.map((r) => [r.key as string, r.value as string]));

  return {
    target_track_count: parseInt(map.target_track_count ?? "50", 10),
    youtube_playlist_id: map.youtube_playlist_id ?? "",
  };
}

export async function GET() {
  try {
    const config = await loadConfig();
    return NextResponse.json(config);
  } catch (err) {
    console.error("[GET /api/config]", err);
    return NextResponse.json({ error: "Failed to load config" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body: Partial<AppConfig> = await request.json();
    const db = getPool();
    const updates: Array<[string, string]> = [];

    if (body.target_track_count !== undefined) {
      const n = Number(body.target_track_count);
      if (!Number.isInteger(n) || n < 1 || n > 200) {
        return NextResponse.json(
          { error: "target_track_count must be an integer between 1 and 200" },
          { status: 400 }
        );
      }
      updates.push(["target_track_count", String(n)]);
    }

    if (body.youtube_playlist_id !== undefined) {
      updates.push(["youtube_playlist_id", body.youtube_playlist_id]);
    }

    for (const [key, value] of updates) {
      await db.query<ResultSetHeader>(
        "INSERT INTO config (`key`, value) VALUES (?, ?) ON DUPLICATE KEY UPDATE value = ?",
        [key, value, value]
      );
    }

    const config = await loadConfig();
    return NextResponse.json(config);
  } catch (err) {
    console.error("[PUT /api/config]", err);
    return NextResponse.json({ error: "Failed to update config" }, { status: 500 });
  }
}
