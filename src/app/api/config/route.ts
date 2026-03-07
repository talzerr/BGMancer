import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import type { AppConfig } from "@/types";

function loadConfig(): AppConfig {
  const rows = getDB().prepare("SELECT key, value FROM config").all() as Array<{ key: string; value: string }>;
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return {
    target_track_count: parseInt(map.target_track_count ?? "50", 10),
    youtube_playlist_id: map.youtube_playlist_id ?? "",
  };
}

export async function GET() {
  try {
    return NextResponse.json(loadConfig());
  } catch (err) {
    console.error("[GET /api/config]", err);
    return NextResponse.json({ error: "Failed to load config" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body: Partial<AppConfig> = await request.json();
    const db = getDB();
    const upsert = db.prepare(`
      INSERT INTO config (key, value) VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET
        value = excluded.value,
        updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
    `);

    if (body.target_track_count !== undefined) {
      const n = Number(body.target_track_count);
      if (!Number.isInteger(n) || n < 1 || n > 200) {
        return NextResponse.json(
          { error: "target_track_count must be an integer between 1 and 200" },
          { status: 400 }
        );
      }
      upsert.run("target_track_count", String(n));
    }

    if (body.youtube_playlist_id !== undefined) {
      upsert.run("youtube_playlist_id", body.youtube_playlist_id);
    }

    return NextResponse.json(loadConfig());
  } catch (err) {
    console.error("[PUT /api/config]", err);
    return NextResponse.json({ error: "Failed to update config" }, { status: 500 });
  }
}
