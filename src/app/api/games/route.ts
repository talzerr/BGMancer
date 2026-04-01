import { NextResponse } from "next/server";
import { Games } from "@/lib/db/repo";
import { YT_IMPORT_GAME_ID, LIBRARY_MAX_GAMES } from "@/lib/constants";
import { CurationMode } from "@/types";
import { withOptionalAuth, withRequiredAuth } from "@/lib/services/route-wrappers";
import { addGameSchema, updateCurationSchema, zodErrorResponse } from "@/lib/validation";

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
  const parsed = addGameSchema.safeParse(await request.json());
  if (!parsed.success) return zodErrorResponse(parsed.error);
  const { gameId, curation = CurationMode.Include } = parsed.data;

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

  const parsed = updateCurationSchema.safeParse(await request.json());
  if (!parsed.success) return zodErrorResponse(parsed.error);

  await Games.setCuration(userId, id, parsed.data.curation);
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
