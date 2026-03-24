import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { Games, Users } from "@/lib/db/repo";
import type { SteamGameInput } from "@/lib/db/repo";
import { LIBRARY_MAX_GAMES } from "@/lib/constants";
import { getOrCreateUserId } from "@/lib/services/session";
import { onboardGame } from "@/lib/pipeline/onboarding";

/**
 * POST /api/steam/import
 *
 * Bulk-imports Steam games into the user's library as curation='skip'.
 * Triggers onboarding (Discogs lookup + tagging) for each newly imported game.
 * Games are sorted by playtime and capped at the library limit.
 */
export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const userId = await getOrCreateUserId(cookieStore);
    Users.getOrCreate(userId);

    const body = (await request.json()) as { games?: unknown };

    if (!Array.isArray(body.games) || body.games.length === 0) {
      return NextResponse.json({ error: "games array is required" }, { status: 400 });
    }

    const games: SteamGameInput[] = (body.games as Array<Record<string, unknown>>)
      .filter(
        (g) =>
          typeof g.appid === "number" &&
          typeof g.name === "string" &&
          typeof g.playtime_forever === "number",
      )
      .map((g) => ({
        appid: g.appid as number,
        name: (g.name as string).trim(),
        playtime_forever: g.playtime_forever as number,
      }));

    if (games.length === 0) {
      return NextResponse.json({ error: "No valid games provided" }, { status: 400 });
    }

    const currentCount = Games.count(userId);
    const capacity = Math.max(0, LIBRARY_MAX_GAMES - currentCount);
    if (capacity === 0) {
      return NextResponse.json(
        {
          error: `Library is full (${LIBRARY_MAX_GAMES} games max). Remove some games to import more.`,
        },
        { status: 400 },
      );
    }

    // Sort by playtime desc so most-played games are prioritised when capacity is limited
    const sorted = [...games].sort((a, b) => b.playtime_forever - a.playtime_forever);
    const gamesToImport = sorted.slice(0, capacity);
    const omitted = games.length - gamesToImport.length;

    const result = Games.bulkImportSteam(userId, gamesToImport);

    void (async () => {
      for (const gameId of result.importedIds) {
        const game = Games.getById(gameId);
        if (!game) continue;
        await onboardGame(game);
      }
    })();

    return NextResponse.json({ ...result, omitted }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/steam/import]", err);
    return NextResponse.json({ error: "Failed to import games" }, { status: 500 });
  }
}
