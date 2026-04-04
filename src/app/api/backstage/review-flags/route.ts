import { ReviewFlags } from "@/lib/db/repo";
import { NextResponse } from "next/server";
import { createLogger } from "@/lib/logger";
import { assertBackstageAuth } from "@/lib/services/cloudflare-access";

const log = createLogger("backstage-review-flags");

/** DELETE /api/backstage/review-flags — dismiss a single flag or clear all for a game */
export async function DELETE(req: Request) {
  assertBackstageAuth(req);
  try {
    const { gameId, flagId } = (await req.json()) as { gameId: string; flagId?: number };
    if (!gameId) {
      return NextResponse.json({ error: "gameId is required" }, { status: 400 });
    }

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
}
