import { NextResponse } from "next/server";
import { createLogger } from "@/lib/logger";
import { GameRequests } from "@/lib/db/repo";
import { acknowledgeGameRequestSchema, zodErrorResponse } from "@/lib/validation";

const log = createLogger("backstage-requests-ack");

/** POST /api/backstage/requests/acknowledge — mark a request as acknowledged. */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = acknowledgeGameRequestSchema.safeParse(body);
  if (!parsed.success) return zodErrorResponse(parsed.error);

  try {
    await GameRequests.acknowledge(parsed.data.igdbId);
    return NextResponse.json({ success: true });
  } catch (err) {
    log.error("handler failed", {}, err);
    return NextResponse.json({ error: "Failed to acknowledge request" }, { status: 500 });
  }
}
