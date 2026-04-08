import { NextResponse } from "next/server";
import { withRequiredAuth } from "@/lib/services/auth/route-wrappers";
import { Users, UserSteamGames } from "@/lib/db/repo";
import { createLogger } from "@/lib/logger";

const log = createLogger("api.steam.library");

/** GET /api/steam/library — Return the current user's Steam link status and matched catalog games. */
export const GET = withRequiredAuth(async (userId) => {
  try {
    const user = await Users.getById(userId);
    if (!user || !user.steam_id) {
      return NextResponse.json({ linked: false });
    }
    const matchedGameIds = await UserSteamGames.getMatchedGameIds(userId);
    return NextResponse.json({
      linked: true,
      steamSyncedAt: user.steam_synced_at,
      matchedGameIds,
    });
  } catch (err) {
    log.error("Steam library fetch failed", { userId }, err);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}, "GET /api/steam/library");
