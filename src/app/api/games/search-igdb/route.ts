import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { createLogger } from "@/lib/logger";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { igdbSearchQuerySchema, zodErrorResponse } from "@/lib/validation";
import { searchGames } from "@/lib/services/external/igdb";

const log = createLogger("search-igdb");

const RATE_LIMIT_MAX = 30;
const RATE_LIMIT_WINDOW_MS = 60_000;

/**
 * GET /api/games/search-igdb?q=... — proxy search against IGDB for the catalog
 * "Request a game" empty state. Returns 404 when IGDB credentials aren't
 * configured; that signals the client to hide the request form.
 */
export async function GET(request: Request) {
  if (!env.igdbClientId || !env.igdbClientSecret) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const parsed = igdbSearchQuerySchema.safeParse({ q: searchParams.get("q") });
  if (!parsed.success) return zodErrorResponse(parsed.error);

  const ip = getClientIp(request);
  const limit = await checkRateLimit(`igdb-search:${ip}`, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS);
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
