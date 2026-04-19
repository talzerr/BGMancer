import { BackstageGames } from "@/lib/db/repo";
import { withAdminAuth } from "@/lib/services/auth/admin-wrapper";
import { bulkPublishSchema, zodErrorResponse } from "@/lib/validation";
import { NextResponse } from "next/server";
import { createLogger } from "@/lib/logger";

const log = createLogger("backstage-publish");

/** POST /api/backstage/bulk-publish — batch publish/unpublish games */
export const POST = withAdminAuth(async (req: Request) => {
  const parsed = bulkPublishSchema.safeParse(await req.json());
  if (!parsed.success) return zodErrorResponse(parsed.error);
  const { gameIds, published } = parsed.data;

  try {
    for (const id of gameIds) {
      await BackstageGames.setPublished(id, published);
    }

    return NextResponse.json({ ok: true, count: gameIds.length });
  } catch (err) {
    log.error("handler failed", {}, err);
    return NextResponse.json({ error: "Failed to bulk update" }, { status: 500 });
  }
}, "backstage-bulk-publish");
