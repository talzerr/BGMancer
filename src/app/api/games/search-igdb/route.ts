import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { createLogger } from "@/lib/logger";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { IGDB_SEARCH_MAX, IGDB_SEARCH_WINDOW_MS } from "@/lib/constants";
import { igdbSearchQuerySchema, zodErrorResponse } from "@/lib/validation";
import { searchGames } from "@/lib/services/external/igdb";

const log = createLogger("search-igdb");

/** GET /api/games/search-igdb?q=... — IGDB proxy. 404 when creds unset. */
export async function GET(request: Request) {
  if (!env.igdbClientId || !env.igdbClientSecret) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const parsed = igdbSearchQuerySchema.safeParse({ q: searchParams.get("q") });
  if (!parsed.success) return zodErrorResponse(parsed.error);

  const ip = getClientIp(request);
  const limit = await checkRateLimit(`igdb-search:${ip}`, IGDB_SEARCH_MAX, IGDB_SEARCH_WINDOW_MS);
  if (!limit.allowed) {
    return NextResponse.json({ error: "Too many requests. Try again shortly." }, { status: 429 });
  }

  try {
    const results = await searchGames(parsed.data.q);
    return NextResponse.json({ results });
  } catch (err) {
    log.error("handler failed", {}, err);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
