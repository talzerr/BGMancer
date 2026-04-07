import { NextResponse } from "next/server";
import { withRequiredAuth } from "@/lib/services/auth/route-wrappers";
import { batch, getDB } from "@/lib/db";
import { users, userSteamGames } from "@/lib/db/drizzle-schema";
import { eq } from "drizzle-orm";
import { createLogger } from "@/lib/logger";

const log = createLogger("api.steam.link");

/** DELETE /api/steam/link — Unlink the current user's Steam account and drop their synced games. */
export const DELETE = withRequiredAuth(async (userId) => {
  try {
    const db = getDB();
    await batch([
      db.delete(userSteamGames).where(eq(userSteamGames.user_id, userId)),
      db.update(users).set({ steam_id: null, steam_synced_at: null }).where(eq(users.id, userId)),
    ]);
    return NextResponse.json({ success: true });
  } catch (err) {
    log.error("Steam unlink failed", { userId }, err);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}, "DELETE /api/steam/link");
