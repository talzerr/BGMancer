import { BackstageGames, Games } from "@/lib/db/repo";
import { NextResponse } from "next/server";
import { createLogger } from "@/lib/logger";

const log = createLogger("backstage-publish");

/** POST /api/backstage/publish — toggle game published status */
export async function POST(req: Request) {
  const { gameId, published } = (await req.json()) as { gameId: string; published: boolean };

  if (!gameId || typeof published !== "boolean") {
    return NextResponse.json(
      { error: "gameId and published (boolean) are required" },
      { status: 400 },
    );
  }

  try {
    const game = await Games.getById(gameId);
    if (!game) {
      return NextResponse.json({ error: "Game not found" }, { status: 404 });
    }

    await BackstageGames.setPublished(gameId, published);
    return NextResponse.json({ ok: true, published });
  } catch (err) {
    log.error("handler failed", {}, err);
    return NextResponse.json({ error: "Failed to update published status" }, { status: 500 });
  }
}
