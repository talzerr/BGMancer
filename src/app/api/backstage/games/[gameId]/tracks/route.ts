import { Games, Tracks, ReviewFlags } from "@/lib/db/repo";
import { NextResponse } from "next/server";
import { createLogger } from "@/lib/logger";
import { assertBackstageAuth } from "@/lib/services/cloudflare-access";

const log = createLogger("backstage-games");

/** GET /api/backstage/games/[gameId]/tracks */
export async function GET(req: Request, { params }: { params: Promise<{ gameId: string }> }) {
  assertBackstageAuth(req);
  try {
    const { gameId } = await params;
    const game = await Games.getById(gameId);
    if (!game) return NextResponse.json({ error: "Game not found" }, { status: 404 });

    const tracks = await Tracks.getByGame(gameId);
    const reviewFlags = await ReviewFlags.listByGame(gameId);

    return NextResponse.json({ game, tracks, reviewFlags });
  } catch (err) {
    log.error("handler failed", {}, err);
    return NextResponse.json({ error: "Failed to load game data" }, { status: 500 });
  }
}
