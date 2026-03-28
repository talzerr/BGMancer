import { Games } from "@/lib/db/repo";
import { CATALOG_PAGE_SIZE } from "@/lib/constants";
import { NextResponse } from "next/server";

/** GET /api/games/catalog — returns published games for the catalog browser */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const search = url.searchParams.get("q") ?? undefined;
    const games = Games.listPublished(search, CATALOG_PAGE_SIZE);
    return NextResponse.json(games);
  } catch (err) {
    console.error("[GET /api/games/catalog]", err);
    return NextResponse.json({ error: "Failed to load catalog" }, { status: 500 });
  }
}
