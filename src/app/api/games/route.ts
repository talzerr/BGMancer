import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { Games, Users } from "@/lib/db/repo";
import { VALID_CURATIONS } from "@/lib/db/mappers";
import { YT_IMPORT_GAME_ID, GAME_TITLE_MAX_LENGTH, LIBRARY_MAX_GAMES } from "@/lib/constants";
import { newId } from "@/lib/uuid";
import { CurationMode } from "@/types";
import type { AddGamePayload } from "@/types";
import { getOrCreateUserId } from "@/lib/services/session";
import { onboardGame } from "@/lib/pipeline/onboarding";

/** GET /api/games — List active games (curation != skip). Pass ?includeDisabled=true to include skipped games. */
export async function GET(request: Request) {
  try {
    const cookieStore = await cookies();
    const userId = await getOrCreateUserId(cookieStore);
    Users.getOrCreate(userId);

    const { searchParams } = new URL(request.url);
    const includeDisabled = searchParams.get("includeDisabled") === "true";
    const games = includeDisabled
      ? Games.listAllIncludingDisabled(userId).filter((g) => g.id !== YT_IMPORT_GAME_ID)
      : Games.listAll(userId, YT_IMPORT_GAME_ID);
    return NextResponse.json(games);
  } catch (err) {
    console.error("[GET /api/games]", err);
    return NextResponse.json({ error: "Failed to fetch games" }, { status: 500 });
  }
}

/** POST /api/games — Add a game to the library. Triggers onboarding (Discogs + tagging) automatically. */
export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const userId = await getOrCreateUserId(cookieStore);
    const user = Users.getOrCreate(userId);

    const body: AddGamePayload = await request.json();

    if (!body.title?.trim()) {
      return NextResponse.json({ error: "Game title is required" }, { status: 400 });
    }
    if (body.title.trim().length > GAME_TITLE_MAX_LENGTH) {
      return NextResponse.json(
        { error: `Game title must be ${GAME_TITLE_MAX_LENGTH} characters or fewer` },
        { status: 400 },
      );
    }
    if (Games.count(userId) >= LIBRARY_MAX_GAMES) {
      return NextResponse.json(
        { error: `Library limit reached (${LIBRARY_MAX_GAMES} games max)` },
        { status: 400 },
      );
    }

    const title = body.title.trim();
    const steamAppid = typeof body.steam_appid === "number" ? body.steam_appid : null;

    const existing = Games.findByTitle(title);
    if (existing) {
      Games.linkToLibrary(userId, existing.id);
      return NextResponse.json(Games.getByIdForUser(userId, existing.id) ?? existing, {
        status: 201,
      });
    }

    const game = Games.create(userId, newId(), title, CurationMode.Include, steamAppid);
    void onboardGame(game, user.tier);
    return NextResponse.json(game, { status: 201 });
  } catch (err) {
    console.error("[POST /api/games]", err);
    return NextResponse.json({ error: "Failed to add game" }, { status: 500 });
  }
}

/** PATCH /api/games?id=<gameId> — Update a game's curation mode. Body: { curation: CurationMode }. */
export async function PATCH(request: Request) {
  try {
    const cookieStore = await cookies();
    const userId = await getOrCreateUserId(cookieStore);

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Game ID is required" }, { status: 400 });
    }

    const body = await request.json();

    if (typeof body.curation !== "string" || !VALID_CURATIONS.has(body.curation as CurationMode)) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
    }

    Games.setCuration(userId, id, body.curation as CurationMode);
    const game = Games.getByIdForUser(userId, id);
    if (!game) {
      return NextResponse.json({ error: "Game not found" }, { status: 404 });
    }
    return NextResponse.json(game);
  } catch (err) {
    console.error("[PATCH /api/games]", err);
    return NextResponse.json({ error: "Failed to update game" }, { status: 500 });
  }
}

/** DELETE /api/games?id=<gameId> — Remove a game from the library. Deletes the game row if it has no other library entries. */
export async function DELETE(request: Request) {
  try {
    const cookieStore = await cookies();
    const userId = await getOrCreateUserId(cookieStore);

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Game ID is required" }, { status: 400 });
    }

    Games.remove(userId, id);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[DELETE /api/games]", err);
    return NextResponse.json({ error: "Failed to delete game" }, { status: 500 });
  }
}
