import { NextResponse } from "next/server";
import { createLogger } from "@/lib/logger";
import { GameRequests } from "@/lib/db/repo";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { gameRequestSchema, zodErrorResponse } from "@/lib/validation";
import { verifyTurnstileToken } from "@/lib/services/external/turnstile";

const log = createLogger("game-request");

const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;

/** POST /api/games/request — Turnstile-gated. Always returns `{ success: true }`. */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = gameRequestSchema.safeParse(body);
  if (!parsed.success) return zodErrorResponse(parsed.error);

  const ip = getClientIp(request);

  // Rate-limit first (cheap KV lookup) so floods don't pay for upstream siteverify.
  const limit = await checkRateLimit(`game-request:${ip}`, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS);
  if (!limit.allowed) {
    return NextResponse.json({ error: "Too many requests. Try again later." }, { status: 429 });
  }

  const verified = await verifyTurnstileToken(parsed.data.turnstileToken, ip);
  if (!verified.success) {
    return NextResponse.json(
      { error: verified.error ?? "Bot verification failed. Please try again." },
      { status: 403 },
    );
  }

  try {
    await GameRequests.upsertRequest(parsed.data.igdbId, parsed.data.name, parsed.data.coverUrl);
    return NextResponse.json({ success: true });
  } catch (err) {
    log.error("handler failed", {}, err);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
