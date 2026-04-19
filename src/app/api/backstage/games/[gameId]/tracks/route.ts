import { Games, Tracks, ReviewFlags } from "@/lib/db/repo";
import { withAdminAuth } from "@/lib/services/auth/admin-wrapper";
import { NextResponse } from "next/server";
import { createLogger } from "@/lib/logger";

const log = createLogger("backstage-games");

/** GET /api/backstage/games/[gameId]/tracks */
export const GET = withAdminAuth(
  async (_req: Request, { params }: { params: Promise<{ gameId: string }> }) => {
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
  },
  "backstage-games-tracks",
);
