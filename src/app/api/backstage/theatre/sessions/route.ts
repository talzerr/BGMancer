import { Sessions } from "@/lib/db/repo";
import { NextResponse } from "next/server";

/** GET /api/backstage/theatre/sessions — recent sessions across all users */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const limit = Math.min(Number(url.searchParams.get("limit") ?? 20), 50);
    const sessions = Sessions.listRecent(limit);
    return NextResponse.json(sessions);
  } catch (err) {
    console.error("[GET /api/backstage/theatre/sessions]", err);
    return NextResponse.json({ error: "Failed to load sessions" }, { status: 500 });
  }
}
