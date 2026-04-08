import { NextResponse } from "next/server";
import { createLogger } from "@/lib/logger";
import { GameRequests } from "@/lib/db/repo";

const log = createLogger("backstage-requests");

/** GET /api/backstage/requests — defaults to unacknowledged only; pass `?all=1` for everything. */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const showAll = searchParams.get("all") === "1";

    const requests = showAll ? await GameRequests.getAll() : await GameRequests.getUnacknowledged();

    return NextResponse.json({ requests });
  } catch (err) {
    log.error("handler failed", {}, err);
    return NextResponse.json({ error: "Failed to load requests" }, { status: 500 });
  }
}
