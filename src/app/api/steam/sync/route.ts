import { NextResponse } from "next/server";
import { withRequiredAuth } from "@/lib/services/auth/route-wrappers";
import { steamSyncSchema, zodErrorResponse } from "@/lib/validation";
import {
  syncUserLibrary,
  MissingSteamUrlError,
  InvalidSteamUrlError,
  VanityNotFoundError,
  PrivateProfileError,
  CooldownError,
  SteamApiError,
} from "@/lib/services/external/steam-sync";
import { createLogger } from "@/lib/logger";

const log = createLogger("api.steam.sync");

/** POST /api/steam/sync — Link and/or resync the current user's Steam library. */
export const POST = withRequiredAuth(async (userId, req: Request) => {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const parsed = steamSyncSchema.safeParse(body);
  if (!parsed.success) return zodErrorResponse(parsed.error);

  try {
    const result = await syncUserLibrary(userId, { steamUrl: parsed.data.steamUrl });
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof MissingSteamUrlError) {
      return NextResponse.json(
        { error: "Steam profile URL is required to connect." },
        { status: 400 },
      );
    }
    if (err instanceof InvalidSteamUrlError) {
      return NextResponse.json(
        { error: "Couldn't find a Steam profile. Check the URL and try again." },
        { status: 400 },
      );
    }
    if (err instanceof VanityNotFoundError) {
      return NextResponse.json(
        { error: "Couldn't find a Steam profile with that URL. Check and try again." },
        { status: 404 },
      );
    }
    if (err instanceof PrivateProfileError) {
      return NextResponse.json(
        {
          error:
            "Steam profile is private. Set your game details to public in Steam privacy settings and try again.",
        },
        { status: 400 },
      );
    }
    if (err instanceof CooldownError) {
      return NextResponse.json(
        {
          error: `Steam library was synced recently. Try again in ${err.minutesRemaining} minutes.`,
          cooldownMinutes: err.minutesRemaining,
        },
        { status: 429 },
      );
    }
    if (err instanceof SteamApiError) {
      log.error("Steam API failure", { userId }, err);
      return NextResponse.json(
        { error: "Could not reach Steam. Please try again." },
        { status: 502 },
      );
    }
    log.error("Steam sync failed", { userId }, err);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}, "POST /api/steam/sync");
