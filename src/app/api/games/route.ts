import { NextResponse } from "next/server";
import { Games } from "@/lib/db/repo";
import { VALID_CURATIONS } from "@/lib/db/mappers";
import { YT_IMPORT_GAME_ID, LIBRARY_MAX_GAMES } from "@/lib/constants";
import { CurationMode } from "@/types";
import { withOptionalAuth, withRequiredAuth } from "@/lib/services/route-wrappers";

/** GET /api/games — List active games (curation != skip). Pass ?includeDisabled=true to include skipped games. */
export const GET = withOptionalAuth(async (userId, request: Request) => {
  if (!userId) return NextResponse.json([]);

  const { searchParams } = new URL(request.url);
  const includeDisabled = searchParams.get("includeDisabled") === "true";
  const games = includeDisabled
    ? (await Games.listAllIncludingDisabled(userId)).filter((g) => g.id !== YT_IMPORT_GAME_ID)
    : await Games.listAll(userId, YT_IMPORT_GAME_ID);
  return NextResponse.json(games);
}, "GET /api/games");

/** POST /api/games — Link a published game to the user's library. */
export const POST = withRequiredAuth(async (userId, request: Request) => {
  const body = await request.json();
  const gameId = typeof body.gameId === "string" ? body.gameId : null;
  const ADD_CURATIONS = new Set([CurationMode.Focus, CurationMode.Include, CurationMode.Lite]);
  const curation =
    typeof body.curation === "string" && ADD_CURATIONS.has(body.curation as CurationMode)
      ? (body.curation as CurationMode)
      : CurationMode.Include;

  if (!gameId) {
    return NextResponse.json({ error: "gameId is required" }, { status: 400 });
  }

  const game = await Games.getById(gameId);
  if (!game || !game.published) {
    return NextResponse.json({ error: "Game not found or not published" }, { status: 404 });
  }

  if ((await Games.count(userId)) >= LIBRARY_MAX_GAMES) {
    return NextResponse.json(
      { error: `Library limit reached (${LIBRARY_MAX_GAMES} games max)` },
      { status: 400 },
    );
  }

  await Games.linkToLibrary(userId, gameId, curation);
  const linked = await Games.getByIdForUser(userId, gameId);
  return NextResponse.json(linked ?? game, { status: 201 });
}, "POST /api/games");

/** PATCH /api/games?id=<gameId> — Update a game's curation mode. Body: { curation: CurationMode }. */
export const PATCH = withRequiredAuth(async (userId, request: Request) => {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Game ID is required" }, { status: 400 });
  }

  const body = await request.json();

  if (typeof body.curation !== "string" || !VALID_CURATIONS.has(body.curation as CurationMode)) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  await Games.setCuration(userId, id, body.curation as CurationMode);
  const game = await Games.getByIdForUser(userId, id);
  if (!game) {
    return NextResponse.json({ error: "Game not found" }, { status: 404 });
  }
  return NextResponse.json(game);
}, "PATCH /api/games");

/** DELETE /api/games?id=<gameId> — Unlink a game from the user's library. Game record is never deleted. */
export const DELETE = withRequiredAuth(async (userId, request: Request) => {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Game ID is required" }, { status: 400 });
  }

  await Games.remove(userId, id);
  return NextResponse.json({ success: true });
}, "DELETE /api/games");
