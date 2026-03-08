import { NextResponse } from "next/server";

export interface SteamGame {
  appid: number;
  name: string;
  playtime_forever: number;
}

/** Extracts a SteamID64 or vanity name from the user-supplied input string. */
function parseInput(raw: string): { type: "steamid"; id: string } | { type: "vanity"; name: string } {
  const input = raw.trim();

  // Bare 17-digit numeric → SteamID64
  if (/^\d{17}$/.test(input)) {
    return { type: "steamid", id: input };
  }

  // steamcommunity.com/profiles/<id>
  const profileMatch = input.match(/steamcommunity\.com\/profiles\/(\d{17})/);
  if (profileMatch) {
    return { type: "steamid", id: profileMatch[1] };
  }

  // steamcommunity.com/id/<vanity>
  const vanityMatch = input.match(/steamcommunity\.com\/id\/([^/?#]+)/);
  if (vanityMatch) {
    return { type: "vanity", name: vanityMatch[1] };
  }

  // Treat anything else as a bare vanity name
  return { type: "vanity", name: input };
}

async function resolveSteamId(vanity: string, apiKey: string): Promise<string | null> {
  const url = `https://api.steampowered.com/ISteamUser/ResolveVanityURL/v1/?key=${apiKey}&vanityurl=${encodeURIComponent(vanity)}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json() as { response?: { success?: number; steamid?: string } };
  if (data.response?.success === 1 && data.response.steamid) {
    return data.response.steamid;
  }
  return null;
}

export async function GET(request: Request) {
  const apiKey = process.env.STEAM_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "missing_key" }, { status: 500 });
  }

  const { searchParams } = new URL(request.url);
  const input = searchParams.get("input")?.trim();
  if (!input) {
    return NextResponse.json({ error: "input_required" }, { status: 400 });
  }

  try {
    const parsed = parseInput(input);

    let steamId: string;
    if (parsed.type === "steamid") {
      steamId = parsed.id;
    } else {
      const resolved = await resolveSteamId(parsed.name, apiKey);
      if (!resolved) {
        return NextResponse.json({ error: "not_found" }, { status: 404 });
      }
      steamId = resolved;
    }

    const url =
      `https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/` +
      `?key=${apiKey}&steamid=${steamId}&include_appinfo=true&include_played_free_games=true`;

    const res = await fetch(url);
    if (!res.ok) {
      return NextResponse.json({ error: "steam_error" }, { status: 502 });
    }

    const data = await res.json() as {
      response?: { game_count?: number; games?: SteamGame[] };
    };

    const games = data.response?.games;
    if (!games || games.length === 0) {
      return NextResponse.json({ error: "private" }, { status: 403 });
    }

    const sorted = [...games]
      .sort((a, b) => b.playtime_forever - a.playtime_forever)
      .map(({ appid, name, playtime_forever }) => ({ appid, name, playtime_forever }));

    return NextResponse.json({ games: sorted });
  } catch (err) {
    console.error("[GET /api/steam/games]", err);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
