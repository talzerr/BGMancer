import { BackstageGames } from "@/lib/db/repo";
import { NextResponse } from "next/server";
import { withAdminAuth } from "@/lib/services/auth/admin-wrapper";
import { createLogger } from "@/lib/logger";

const log = createLogger("backstage-dashboard");

/** GET /api/backstage/dashboard — aggregate counts for the Backstage dashboard */
export const GET = withAdminAuth(async (_req: Request) => {
  try {
    const counts = await BackstageGames.dashboardCounts();
    return NextResponse.json(counts);
  } catch (err) {
    log.error("handler failed", {}, err);
    return NextResponse.json({ error: "Failed to load dashboard" }, { status: 500 });
  }
}, "backstage-dashboard");
