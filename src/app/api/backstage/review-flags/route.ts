import { ReviewFlags } from "@/lib/db/repo";
import { NextResponse } from "next/server";

/** DELETE /api/backstage/review-flags — clear all review flags for a game */
export async function DELETE(req: Request) {
  try {
    const { gameId } = (await req.json()) as { gameId: string };
    if (!gameId) {
      return NextResponse.json({ error: "gameId is required" }, { status: 400 });
    }
    ReviewFlags.clearByGame(gameId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[DELETE /api/backstage/review-flags]", err);
    return NextResponse.json({ error: "Failed to clear review flags" }, { status: 500 });
  }
}
