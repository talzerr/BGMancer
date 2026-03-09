import { NextResponse } from "next/server";
import { Sessions } from "@/lib/db/repo";

export async function GET() {
  try {
    return NextResponse.json(Sessions.listAllWithCounts());
  } catch (err) {
    console.error("[GET /api/sessions]", err);
    return NextResponse.json({ error: "Failed to fetch sessions" }, { status: 500 });
  }
}
