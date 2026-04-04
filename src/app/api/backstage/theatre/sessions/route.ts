import { Sessions } from "@/lib/db/repo";
import { NextResponse } from "next/server";
import { createLogger } from "@/lib/logger";
import { assertBackstageAuth } from "@/lib/services/cloudflare-access";

const log = createLogger("backstage-theatre");

/** GET /api/backstage/theatre/sessions — recent sessions across all users */
export async function GET(req: Request) {
  assertBackstageAuth(req);
  try {
    const url = new URL(req.url);
    const limit = Math.min(Number(url.searchParams.get("limit") ?? 20), 50);
    const sessions = await Sessions.listRecent(limit);
    return NextResponse.json(sessions);
  } catch (err) {
    log.error("handler failed", {}, err);
    return NextResponse.json({ error: "Failed to load sessions" }, { status: 500 });
  }
}
