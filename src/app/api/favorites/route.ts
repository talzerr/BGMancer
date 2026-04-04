import { NextResponse } from "next/server";
import { Favorites } from "@/lib/db/repo";
import { withOptionalAuth, withRequiredAuth } from "@/lib/services/route-wrappers";
import { toggleFavoriteSchema, zodErrorResponse } from "@/lib/validation";

/** GET /api/favorites — List user's favorite game IDs. Guests get []. */
export const GET = withOptionalAuth(async (userId) => {
  if (!userId) return NextResponse.json([]);
  const ids = await Favorites.listByUser(userId);
  return NextResponse.json(ids);
}, "GET /api/favorites");

/** POST /api/favorites — Toggle a game favorite. Returns { favorited: boolean }. */
export const POST = withRequiredAuth(async (userId, request: Request) => {
  const parsed = toggleFavoriteSchema.safeParse(await request.json());
  if (!parsed.success) return zodErrorResponse(parsed.error);

  const favorited = await Favorites.toggle(userId, parsed.data.gameId);
  return NextResponse.json({ favorited });
}, "POST /api/favorites");
