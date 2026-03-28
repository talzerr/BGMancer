import { BackstageGames } from "@/lib/db/repo";
import { NextResponse } from "next/server";

/** GET /api/backstage/games — search games with optional filters */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const title = url.searchParams.get("title") ?? undefined;
    const phase = url.searchParams.get("phase") ?? undefined;
    const needsReviewParam = url.searchParams.get("needsReview");
    const needsReview =
      needsReviewParam === "1" ? true : needsReviewParam === "0" ? false : undefined;
    const publishedParam = url.searchParams.get("published");
    const published = publishedParam === "1" ? true : publishedParam === "0" ? false : undefined;

    const games = BackstageGames.searchWithStats({ title, phase, needsReview, published });
    return NextResponse.json(games);
  } catch (err) {
    console.error("[GET /api/backstage/games]", err);
    return NextResponse.json({ error: "Failed to query games" }, { status: 500 });
  }
}

/** POST /api/backstage/games — create a new draft game */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const title = typeof body.title === "string" ? body.title.trim() : "";
    if (!title) {
      return NextResponse.json({ error: "title is required" }, { status: 400 });
    }
    const steamAppid = typeof body.steamAppid === "number" ? body.steamAppid : null;
    const game = BackstageGames.createDraft(title, steamAppid);
    return NextResponse.json(game, { status: 201 });
  } catch (err) {
    console.error("[POST /api/backstage/games]", err);
    return NextResponse.json({ error: "Failed to create game" }, { status: 500 });
  }
}
