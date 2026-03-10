import { NextResponse } from "next/server";
import { Games } from "@/lib/db/repo";
import { VALID_CURATIONS } from "@/lib/db/mappers";
import { YT_IMPORT_GAME_ID } from "@/lib/constants";
import { newId } from "@/lib/uuid";
import { CurationMode } from "@/types";
import type { AddGamePayload } from "@/types";

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

    const id = newId();
    const steamAppid = typeof body.steam_appid === "number" ? body.steam_appid : null;
    const game = Games.create(id, body.title.trim(), CurationMode.Include, steamAppid);
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
    const fields: { curation?: CurationMode } = {};

    if (typeof body.curation === "string" && VALID_CURATIONS.has(body.curation as CurationMode)) {
      fields.curation = body.curation as CurationMode; // validated against enum values
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
