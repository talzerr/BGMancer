import { NextResponse } from "next/server";
import { Games } from "@/lib/db/repo";
import { YT_IMPORT_GAME_ID } from "@/lib/constants";
import type { AddGamePayload, VibePreference } from "@/types";

const VALID_VIBES = new Set<string>(["official_soundtrack", "boss_themes", "ambient_exploration"]);

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const includeDisabled = searchParams.get("includeDisabled") === "true";
    const games = includeDisabled
      ? Games.listAllIncludingDisabled()
      : Games.listAll(YT_IMPORT_GAME_ID);
    return NextResponse.json(games);
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
    if (!VALID_VIBES.has(body.vibe_preference)) {
      return NextResponse.json({ error: "Invalid vibe preference" }, { status: 400 });
    }

    const id = crypto.randomUUID();
    const steamAppid = typeof body.steam_appid === "number" ? body.steam_appid : null;
    const game = Games.create(id, body.title.trim(), body.vibe_preference, !!body.allow_full_ost, true, steamAppid);
    return NextResponse.json(game, { status: 201 });
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
    const fields: { allow_full_ost?: boolean; vibe_preference?: string; enabled?: boolean } = {};

    if (typeof body.allow_full_ost === "boolean") {
      fields.allow_full_ost = body.allow_full_ost;
    }
    if (typeof body.vibe_preference === "string" && VALID_VIBES.has(body.vibe_preference)) {
      fields.vibe_preference = body.vibe_preference as VibePreference;
    }
    if (typeof body.enabled === "boolean") {
      fields.enabled = body.enabled;
    }

    if (Object.keys(fields).length === 0) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
    }

    const game = Games.update(id, fields);
    if (!game) {
      return NextResponse.json({ error: "Game not found" }, { status: 404 });
    }
    return NextResponse.json(game);
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

    Games.remove(id);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[DELETE /api/games]", err);
    return NextResponse.json({ error: "Failed to delete game" }, { status: 500 });
  }
}
