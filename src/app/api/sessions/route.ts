import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { Sessions, Users } from "@/lib/db/repo";
import { getOrCreateUserId } from "@/lib/services/session";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const userId = await getOrCreateUserId(cookieStore);
    Users.getOrCreate(userId);

    return NextResponse.json(Sessions.listAllWithCounts(userId));
  } catch (err) {
    console.error("[GET /api/sessions]", err);
    return NextResponse.json({ error: "Failed to fetch sessions" }, { status: 500 });
  }
}
