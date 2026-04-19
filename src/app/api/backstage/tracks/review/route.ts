import { Tracks } from "@/lib/db/repo";
import { withAdminAuth } from "@/lib/services/auth/admin-wrapper";
import { tracksReviewSchema, zodErrorResponse } from "@/lib/validation";
import { NextResponse } from "next/server";
import { createLogger } from "@/lib/logger";

const log = createLogger("backstage-review");

/** POST /api/backstage/tracks/review — batch approve/reject discovered tracks */
export const POST = withAdminAuth(async (req: Request) => {
  const parsed = tracksReviewSchema.safeParse(await req.json());
  if (!parsed.success) return zodErrorResponse(parsed.error);
  const body = parsed.data;

  try {
    if (body.approve?.length) {
      await Tracks.approveDiscovered(body.gameId, body.approve);
    }
    if (body.reject?.length) {
      await Tracks.rejectDiscovered(body.gameId, body.reject);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    log.error("handler failed", {}, err);
    return NextResponse.json({ error: "Failed to review tracks" }, { status: 500 });
  }
}, "backstage-tracks-review");
