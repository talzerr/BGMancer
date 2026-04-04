import { BackstageGames } from "@/lib/db/repo";
import { NextResponse } from "next/server";
import { createLogger } from "@/lib/logger";
import { assertBackstageAuth } from "@/lib/services/cloudflare-access";

const log = createLogger("backstage-dashboard");

/** GET /api/backstage/dashboard — aggregate counts for the Backstage dashboard */
export async function GET(req: Request) {
  assertBackstageAuth(req);
  try {
    const counts = await BackstageGames.dashboardCounts();
    return NextResponse.json(counts);
  } catch (err) {
    log.error("handler failed", {}, err);
    return NextResponse.json({ error: "Failed to load dashboard" }, { status: 500 });
  }
}
