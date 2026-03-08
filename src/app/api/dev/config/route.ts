import { NextResponse } from "next/server";
import { Config } from "@/lib/db/repo";

export async function GET() {
  try {
    return NextResponse.json(Config.loadRaw());
  } catch (err) {
    console.error("[GET /api/dev/config]", err);
    return NextResponse.json({ error: "Failed to load config" }, { status: 500 });
  }
}
