import { NextResponse } from "next/server";
import { Sessions } from "@/lib/db/repo";
import { withOptionalAuth } from "@/lib/services/auth/route-wrappers";

/** GET /api/sessions — List all sessions for the current user with track counts. */
export const GET = withOptionalAuth(async (userId) => {
  if (!userId) return NextResponse.json([]);
  return NextResponse.json(await Sessions.listAllWithCounts(userId));
}, "GET /api/sessions");
