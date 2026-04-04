import { BackstageGames } from "@/lib/db/repo";
import { NextResponse } from "next/server";
import { createLogger } from "@/lib/logger";
import { gameTitleSchema } from "@/lib/validation";
import { assertBackstageAuth } from "@/lib/services/cloudflare-access";

const log = createLogger("backstage-games");

/** GET /api/backstage/games — search games with optional filters */
export async function GET(req: Request) {
  assertBackstageAuth(req);
  try {
    const url = new URL(req.url);
    const title = url.searchParams.get("title") ?? undefined;
    const phase = url.searchParams.get("phase") ?? undefined;
    const needsReviewParam = url.searchParams.get("needsReview");
    const needsReview =
      needsReviewParam === "1" ? true : needsReviewParam === "0" ? false : undefined;
    const publishedParam = url.searchParams.get("published");
    const published = publishedParam === "1" ? true : publishedParam === "0" ? false : undefined;

    const games = await BackstageGames.searchWithStats({ title, phase, needsReview, published });
    return NextResponse.json(games);
  } catch (err) {
    log.error("handler failed", {}, err);
    return NextResponse.json({ error: "Failed to query games" }, { status: 500 });
  }
}

/** POST /api/backstage/games — create a new draft game */
export async function POST(req: Request) {
  assertBackstageAuth(req);
  try {
    const body = (await req.json()) as { title?: string; steamAppid?: number };
    const parsed = gameTitleSchema.safeParse(body.title);
    if (!parsed.success) {
      return NextResponse.json({ error: "title is required" }, { status: 400 });
    }
    const title = parsed.data;
    const steamAppid = typeof body.steamAppid === "number" ? body.steamAppid : null;
    const game = await BackstageGames.createDraft(title, steamAppid);
    return NextResponse.json(game, { status: 201 });
  } catch (err) {
    log.error("handler failed", {}, err);
    return NextResponse.json({ error: "Failed to create game" }, { status: 500 });
  }
}
