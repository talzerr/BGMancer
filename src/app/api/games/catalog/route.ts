import { Games } from "@/lib/db/repo";
import { NextResponse } from "next/server";
import { createLogger } from "@/lib/logger";

const log = createLogger("catalog");

/** GET /api/games/catalog — returns published games for the catalog browser */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const search = url.searchParams.get("q") ?? undefined;
    const games = await Games.listPublished(search);
    const response = NextResponse.json(games);
    response.headers.set("Cache-Control", "public, s-maxage=300");
    response.headers.set("CDN-Cache-Control", "public, max-age=300");
    response.headers.set("Vary", "Accept-Encoding");
    return response;
  } catch (err) {
    log.error("handler failed", {}, err);
    return NextResponse.json({ error: "Failed to load catalog" }, { status: 500 });
  }
}
