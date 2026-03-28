import { Games } from "@/lib/db/repo";
import { NextResponse } from "next/server";

/** GET /api/backstage/dashboard — aggregate counts for the Backstage dashboard */
export async function GET() {
  try {
    const counts = Games.dashboardCounts();
    return NextResponse.json(counts);
  } catch (err) {
    console.error("[GET /api/backstage/dashboard]", err);
    return NextResponse.json({ error: "Failed to load dashboard" }, { status: 500 });
  }
}
