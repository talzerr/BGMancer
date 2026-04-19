import { BackstageGames } from "@/lib/db/repo";
import { withAdminAuth } from "@/lib/services/auth/admin-wrapper";
import { NextResponse } from "next/server";
import { createLogger } from "@/lib/logger";

const log = createLogger("backstage-publish");

/** POST /api/backstage/bulk-publish — batch publish/unpublish games */
export const POST = withAdminAuth(async (req: Request) => {
  try {
    const { gameIds, published } = (await req.json()) as {
      gameIds: string[];
      published: boolean;
    };

    if (!Array.isArray(gameIds) || gameIds.length === 0) {
      return NextResponse.json({ error: "gameIds array is required" }, { status: 400 });
    }
    if (typeof published !== "boolean") {
      return NextResponse.json({ error: "published boolean is required" }, { status: 400 });
    }

    for (const id of gameIds) {
      await BackstageGames.setPublished(id, published);
    }

    return NextResponse.json({ ok: true, count: gameIds.length });
  } catch (err) {
    log.error("handler failed", {}, err);
    return NextResponse.json({ error: "Failed to bulk update" }, { status: 500 });
  }
}, "backstage-bulk-publish");
