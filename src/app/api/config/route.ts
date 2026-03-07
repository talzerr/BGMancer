import { NextResponse } from "next/server";
import { Config } from "@/lib/db/repo";
import type { AppConfig } from "@/types";

export async function GET() {
  try {
    return NextResponse.json(Config.load());
  } catch (err) {
    console.error("[GET /api/config]", err);
    return NextResponse.json({ error: "Failed to load config" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body: Partial<AppConfig> = await request.json();

    if (body.target_track_count !== undefined) {
      const n = Number(body.target_track_count);
      if (!Number.isInteger(n) || n < 1 || n > 200) {
        return NextResponse.json(
          { error: "target_track_count must be an integer between 1 and 200" },
          { status: 400 }
        );
      }
      Config.upsert("target_track_count", String(n));
    }

    if (body.youtube_playlist_id !== undefined) {
      Config.upsert("youtube_playlist_id", body.youtube_playlist_id);
    }

    return NextResponse.json(Config.load());
  } catch (err) {
    console.error("[PUT /api/config]", err);
    return NextResponse.json({ error: "Failed to update config" }, { status: 500 });
  }
}
