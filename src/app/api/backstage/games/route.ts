import { BackstageGames } from "@/lib/db/repo";
import { withAdminAuth } from "@/lib/services/auth/admin-wrapper";
import { NextResponse } from "next/server";
import { createLogger } from "@/lib/logger";
import { createGameSchema, zodErrorResponse } from "@/lib/validation";

const log = createLogger("backstage-games");

/** GET /api/backstage/games — search games with optional filters */
export const GET = withAdminAuth(async (req: Request) => {
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
}, "backstage-games");

/** POST /api/backstage/games — create a new draft game */
export const POST = withAdminAuth(async (req: Request) => {
  const parsed = createGameSchema.safeParse(await req.json());
  if (!parsed.success) return zodErrorResponse(parsed.error);
  const { title, steamAppid } = parsed.data;

  try {
    const game = await BackstageGames.createDraft(title, steamAppid ?? null);
    return NextResponse.json(game, { status: 201 });
  } catch (err) {
    log.error("handler failed", {}, err);
    return NextResponse.json({ error: "Failed to create game" }, { status: 500 });
  }
}, "backstage-games");
