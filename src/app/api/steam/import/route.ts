import { NextResponse } from "next/server";
import { Games } from "@/lib/db/repo";
import type { SteamGameInput } from "@/lib/db/repo";

export async function POST(request: Request) {
  try {
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

    const result = Games.bulkImportSteam(games);
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    console.error("[POST /api/steam/import]", err);
    return NextResponse.json({ error: "Failed to import games" }, { status: 500 });
  }
}
