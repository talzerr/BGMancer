import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { Playlist, Users } from "@/lib/db/repo";
import { getOrCreateUserId } from "@/lib/services/session";

/** GET /api/playlist — Fetch tracks for the active session, or a specific session via ?sessionId=. */
export async function GET(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const userId = await getOrCreateUserId(cookieStore);
    await Users.getOrCreate(userId);

    const sessionId = req.nextUrl.searchParams.get("sessionId") ?? undefined;
    return NextResponse.json(await Playlist.listAllWithGameTitle(userId, sessionId));
  } catch (err) {
    console.error("[GET /api/playlist]", err);
    return NextResponse.json({ error: "Failed to fetch playlist" }, { status: 500 });
  }
}

/** DELETE /api/playlist — Clear all tracks for the current user. */
export async function DELETE() {
  try {
    const cookieStore = await cookies();
    const userId = await getOrCreateUserId(cookieStore);

    await Playlist.clearAll(userId);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[DELETE /api/playlist]", err);
    return NextResponse.json({ error: "Failed to clear playlist" }, { status: 500 });
  }
}

/** PATCH /api/playlist — Reorder tracks. Body: { orderedIds: string[] }. */
export async function PATCH(req: NextRequest) {
  try {
    const { orderedIds } = (await req.json()) as { orderedIds: string[] };
    if (!Array.isArray(orderedIds)) {
      return NextResponse.json({ error: "orderedIds must be an array" }, { status: 400 });
    }
    await Playlist.reorder(orderedIds);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[PATCH /api/playlist]", err);
    return NextResponse.json({ error: "Failed to reorder playlist" }, { status: 500 });
  }
}
