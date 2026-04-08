import { NextResponse } from "next/server";
import { createLogger } from "@/lib/logger";
import { sanitizeGameTitle } from "@/lib/utils";

const log = createLogger("steam");

export interface SteamSearchResult {
  appid: number;
  name: string;
  tiny_image: string;
}

/** GET /api/backstage/steam/search?q=<query> — Search the Steam store for games by name. Returns up to 8 results. */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim();

  if (!q || q.length < 2) {
    return NextResponse.json({ results: [] });
  }

  try {
    const url =
      `https://store.steampowered.com/api/storesearch/` +
      `?term=${encodeURIComponent(q)}&l=english&cc=US&f=games`;

    const res = await fetch(url, {
      headers: { "Accept-Language": "en-US,en;q=0.9" },
      next: { revalidate: 60 },
    });

    if (!res.ok) {
      return NextResponse.json({ results: [] });
    }

    const data = (await res.json()) as {
      items?: Array<{ id: number; name: string; tiny_image: string }>;
    };

    const results: SteamSearchResult[] = (data.items ?? [])
      .slice(0, 8)
      .map(({ id, name, tiny_image }) => ({
        appid: id,
        name: sanitizeGameTitle(name),
        tiny_image,
      }));

    return NextResponse.json({ results });
  } catch (err) {
    log.error("handler failed", {}, err);
    return NextResponse.json({ results: [] });
  }
}
