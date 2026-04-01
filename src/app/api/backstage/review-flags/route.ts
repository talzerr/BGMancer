import { ReviewFlags } from "@/lib/db/repo";
import { NextResponse } from "next/server";

/** DELETE /api/backstage/review-flags — dismiss a single flag or clear all for a game */
export async function DELETE(req: Request) {
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
    console.error("[DELETE /api/backstage/review-flags]", err);
    return NextResponse.json({ error: "Failed to clear review flags" }, { status: 500 });
  }
}
