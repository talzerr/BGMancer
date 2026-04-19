import { BackstageGames, Games } from "@/lib/db/repo";
import { withAdminAuth } from "@/lib/services/auth/admin-wrapper";
import { publishSchema, zodErrorResponse } from "@/lib/validation";
import { NextResponse } from "next/server";
import { createLogger } from "@/lib/logger";

const log = createLogger("backstage-publish");

/** POST /api/backstage/publish — toggle game published status */
export const POST = withAdminAuth(async (req: Request) => {
  const parsed = publishSchema.safeParse(await req.json());
  if (!parsed.success) return zodErrorResponse(parsed.error);
  const { gameId, published } = parsed.data;

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
}, "backstage-publish");
