import { NextResponse } from "next/server";
import { createLogger } from "@/lib/logger";
import { GameRequests } from "@/lib/db/repo";

const log = createLogger("backstage-requests");

/**
 * GET /api/backstage/requests?acknowledged=0|1
 *
 * Admin-only (enforced by middleware via AuthLevel.Admin in route-config).
 * Returns the game request queue, ordered by request_count desc.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const acknowledgedParam = searchParams.get("acknowledged");
    const showAcknowledged = acknowledgedParam === "1";

    const requests = showAcknowledged
      ? await GameRequests.getAll()
      : await GameRequests.getUnacknowledged();

    return NextResponse.json({ requests });
  } catch (err) {
    log.error("handler failed", {}, err);
    return NextResponse.json({ error: "Failed to load requests" }, { status: 500 });
  }
}
