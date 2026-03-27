import { Games } from "@/lib/db/repo";
import type { GameUpdateFields } from "@/lib/db/repos/games";
import { NextResponse } from "next/server";

/** PATCH /api/backstage/games/[gameId] — update game metadata */
export async function PATCH(req: Request, { params }: { params: Promise<{ gameId: string }> }) {
  const { gameId } = await params;
  const game = Games.getById(gameId);
  if (!game) {
    return NextResponse.json({ error: "Game not found" }, { status: 404 });
  }

  const body = (await req.json()) as Partial<GameUpdateFields>;

  const fields: GameUpdateFields = {};
  if (body.title !== undefined) fields.title = body.title;
  if (body.steam_appid !== undefined) fields.steam_appid = body.steam_appid;
  if (body.tracklist_source !== undefined) fields.tracklist_source = body.tracklist_source;
  if (body.yt_playlist_id !== undefined) fields.yt_playlist_id = body.yt_playlist_id;
  if (body.thumbnail_url !== undefined) fields.thumbnail_url = body.thumbnail_url;

  if (Object.keys(fields).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const updated = Games.update(gameId, fields);
  return NextResponse.json(updated);
}

/** DELETE /api/backstage/games/[gameId] — permanently delete a game and all associated data */
export async function DELETE(_req: Request, { params }: { params: Promise<{ gameId: string }> }) {
  const { gameId } = await params;
  const game = Games.getById(gameId);
  if (!game) {
    return NextResponse.json({ error: "Game not found" }, { status: 404 });
  }
  if (game.published) {
    return NextResponse.json(
      { error: "Cannot delete a published game. Unpublish it first." },
      { status: 400 },
    );
  }

  try {
    Games.destroy(gameId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[DELETE /api/backstage/games]", err);
    return NextResponse.json({ error: "Failed to delete game" }, { status: 500 });
  }
}
