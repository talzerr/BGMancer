import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { Playlist } from "@/lib/db/repo";
import { withOptionalAuth, withRequiredAuth } from "@/lib/services/auth/route-wrappers";
import { reorderSchema, zodErrorResponse } from "@/lib/validation";

/** GET /api/playlist — Fetch tracks for the active session, or a specific session via ?sessionId=. */
export const GET = withOptionalAuth(async (userId, req: NextRequest) => {
  if (!userId) return NextResponse.json([]);

  const sessionId = req.nextUrl.searchParams.get("sessionId") ?? undefined;
  return NextResponse.json(await Playlist.listAllWithGameTitle(userId, sessionId));
}, "GET /api/playlist");

/** DELETE /api/playlist — Clear all tracks for the current user. */
export const DELETE = withRequiredAuth(async (userId) => {
  await Playlist.clearAll(userId);
  return NextResponse.json({ success: true });
}, "DELETE /api/playlist");

/** PATCH /api/playlist — Reorder tracks. Body: { orderedIds: string[] }. */
export const PATCH = withOptionalAuth(async (userId, req: Request) => {
  if (!userId) return NextResponse.json({ success: true });

  const parsed = reorderSchema.safeParse(await req.json());
  if (!parsed.success) return zodErrorResponse(parsed.error);

  const owned = await Playlist.verifyTrackOwnership(userId, parsed.data.orderedIds);
  if (!owned) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await Playlist.reorder(parsed.data.orderedIds);
  return NextResponse.json({ success: true });
}, "PATCH /api/playlist");
