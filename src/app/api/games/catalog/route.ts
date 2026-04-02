import { BackstageGames } from "@/lib/db/repo";
import { CATALOG_PAGE_SIZE } from "@/lib/constants";
import { NextResponse } from "next/server";
import { createLogger } from "@/lib/logger";

const log = createLogger("catalog");

/** GET /api/games/catalog — returns published games for the catalog browser */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const search = url.searchParams.get("q") ?? undefined;
    const games = await BackstageGames.listPublished(search, CATALOG_PAGE_SIZE);
    const response = NextResponse.json(games);
    response.headers.set("Cache-Control", "public, s-maxage=300");
    return response;
  } catch (err) {
    log.error("handler failed", {}, err);
    return NextResponse.json({ error: "Failed to load catalog" }, { status: 500 });
  }
}
