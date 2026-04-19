import { ReviewFlags } from "@/lib/db/repo";
import { withAdminAuth } from "@/lib/services/auth/admin-wrapper";
import { reviewFlagsDeleteSchema, zodErrorResponse } from "@/lib/validation";
import { NextResponse } from "next/server";
import { createLogger } from "@/lib/logger";

const log = createLogger("backstage-review-flags");

/** DELETE /api/backstage/review-flags — dismiss a single flag or clear all for a game */
export const DELETE = withAdminAuth(async (req: Request) => {
  const parsed = reviewFlagsDeleteSchema.safeParse(await req.json());
  if (!parsed.success) return zodErrorResponse(parsed.error);
  const { gameId, flagId } = parsed.data;

  try {
    if (flagId != null) {
      await ReviewFlags.dismiss(flagId, gameId);
    } else {
      await ReviewFlags.clearByGame(gameId);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    log.error("handler failed", {}, err);
    return NextResponse.json({ error: "Failed to clear review flags" }, { status: 500 });
  }
}, "backstage-review-flags");
