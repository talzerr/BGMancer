// IGDB search service for the catalog "Request a game" empty state.
// Auth: Twitch OAuth client-credentials with a per-isolate token cache.
// All errors return [] — this is a soft feature.

import { env } from "@/lib/env";
import { createLogger } from "@/lib/logger";

const log = createLogger("igdb");

const TOKEN_URL = "https://id.twitch.tv/oauth2/token";
const SEARCH_URL = "https://api.igdb.com/v4/games";
const COVER_URL_PREFIX = "https://images.igdb.com/igdb/image/upload/t_thumb/";

// IGDB category exclusions: dlc(1), bundle(3), mod(5), episode(6), season(7), fork(12), pack(13), update(14)
const EXCLUDED_CATEGORIES = new Set([1, 3, 5, 6, 7, 12, 13, 14]);

interface CachedToken {
  value: string;
  expiresAt: number;
}

let tokenCache: CachedToken | null = null;

async function getAccessToken(): Promise<string | null> {
  if (!env.igdbClientId || !env.igdbClientSecret) return null;

  if (tokenCache && tokenCache.expiresAt > Date.now() + 60_000) {
    return tokenCache.value;
  }

  try {
    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: env.igdbClientId,
        client_secret: env.igdbClientSecret,
        grant_type: "client_credentials",
      }),
    });
    if (!res.ok) {
      log.warn("token fetch failed", { status: res.status });
      return null;
    }
    const data = (await res.json()) as { access_token: string; expires_in: number };
    tokenCache = {
      value: data.access_token,
      expiresAt: Date.now() + data.expires_in * 1000,
    };
    return tokenCache.value;
  } catch (err) {
    log.error("token fetch threw", {}, err);
    return null;
  }
}

export interface IgdbSearchResult {
  igdbId: number;
  name: string;
  coverUrl: string | null;
}

interface RawGame {
  id: number;
  name: string;
  category?: number;
  cover?: { image_id: string };
  parent_game?: number;
  version_parent?: number;
}

export async function searchGames(query: string): Promise<IgdbSearchResult[]> {
  const token = await getAccessToken();
  if (!token || !env.igdbClientId) return [];

  // Apicalypse syntax. Escape quotes in the user query.
  const safeQuery = query.replace(/"/g, "");
  const body =
    `search "${safeQuery}"; ` +
    `fields name, category, cover.image_id, parent_game, version_parent; ` +
    `limit 50;`;

  try {
    const res = await fetch(SEARCH_URL, {
      method: "POST",
      headers: {
        "Client-ID": env.igdbClientId,
        Authorization: `Bearer ${token}`,
        "Content-Type": "text/plain",
        Accept: "application/json",
      },
      body,
    });
    if (!res.ok) {
      log.warn("search failed", { status: res.status });
      return [];
    }
    const data = (await res.json()) as RawGame[];

    // IGDB doesn't reliably combine `search` with `where` — filter + dedupe here.
    // version_parent excludes platform re-releases; parent_game excludes DLC/packs;
    // category is a backstop. Then dedupe by lowercased name, first wins.
    const filtered = data.filter(
      (g) =>
        g.version_parent === undefined &&
        g.parent_game === undefined &&
        (g.category === undefined || !EXCLUDED_CATEGORIES.has(g.category)),
    );

    const seen = new Set<string>();
    const deduped: RawGame[] = [];
    for (const g of filtered) {
      const key = g.name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      deduped.push(g);
    }

    return deduped.slice(0, 10).map((g) => ({
      igdbId: g.id,
      name: g.name,
      coverUrl: g.cover ? `${COVER_URL_PREFIX}${g.cover.image_id}.jpg` : null,
    }));
  } catch (err) {
    log.error("search threw", {}, err);
    return [];
  }
}

/** Test-only: reset the in-memory token cache. */
export function _resetIgdbTokenCacheForTest(): void {
  tokenCache = null;
}
