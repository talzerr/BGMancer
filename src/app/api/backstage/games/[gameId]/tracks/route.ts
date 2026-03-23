import { Games, Tracks, ReviewFlags } from "@/lib/db/repo";
import { NextResponse } from "next/server";

/** GET /api/backstage/games/[gameId]/tracks */
export async function GET(_req: Request, { params }: { params: Promise<{ gameId: string }> }) {
  const { gameId } = await params;
  const game = Games.getById(gameId);
  if (!game) return NextResponse.json({ error: "Game not found" }, { status: 404 });

  const tracks = Tracks.getByGame(gameId);
  const reviewFlags = ReviewFlags.listByGame(gameId);

  return NextResponse.json({ game, tracks, reviewFlags });
}
