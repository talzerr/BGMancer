import { Games } from "@/lib/db/repo";
import { NextResponse } from "next/server";

/** GET /api/backstage/games — search games with optional filters */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const title = url.searchParams.get("title") ?? undefined;
    const status = url.searchParams.get("status") ?? undefined;
    const needsReview = url.searchParams.get("needsReview") === "1";

    const games = Games.searchWithStats({ title, status, needsReview });
    return NextResponse.json(games);
  } catch (err) {
    console.error("[GET /api/backstage/games]", err);
    return NextResponse.json({ error: "Failed to query games" }, { status: 500 });
  }
}
