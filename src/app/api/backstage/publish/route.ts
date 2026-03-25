import { Games } from "@/lib/db/repo";
import { NextResponse } from "next/server";

/** POST /api/backstage/publish — toggle game published status */
export async function POST(req: Request) {
  const { gameId, published } = (await req.json()) as { gameId: string; published: boolean };

  if (!gameId || typeof published !== "boolean") {
    return NextResponse.json(
      { error: "gameId and published (boolean) are required" },
      { status: 400 },
    );
  }

  const game = Games.getById(gameId);
  if (!game) {
    return NextResponse.json({ error: "Game not found" }, { status: 404 });
  }

  Games.setPublished(gameId, published);
  return NextResponse.json({ ok: true, published });
}
