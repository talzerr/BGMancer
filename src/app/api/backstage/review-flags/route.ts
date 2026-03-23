import { ReviewFlags } from "@/lib/db/repo";
import { NextResponse } from "next/server";

/** DELETE /api/backstage/review-flags — clear all review flags for a game */
export async function DELETE(req: Request) {
  const { gameId } = (await req.json()) as { gameId: string };
  if (!gameId) {
    return NextResponse.json({ error: "gameId is required" }, { status: 400 });
  }
  ReviewFlags.clearByGame(gameId);
  return NextResponse.json({ ok: true });
}
