/**
 * IGDB search service. Used by the catalog "Request a game" empty state.
 *
 * Auth: Twitch OAuth client-credentials flow. Token is cached in module scope
 * per Worker isolate — tokens last ~60 days, so cold-start refresh is cheap.
 *
 * All errors are swallowed — the caller gets an empty result set. This is a
 * soft feature: if IGDB is down, the user should see "no results" rather than
 * a broken page.
 */

import { env } from "@/lib/env";
import { createLogger } from "@/lib/logger";

const log = createLogger("igdb");

const TOKEN_URL = "https://id.twitch.tv/oauth2/token";
const SEARCH_URL = "https://api.igdb.com/v4/games";
const COVER_URL_PREFIX = "https://images.igdb.com/igdb/image/upload/t_thumb/";

// IGDB category enum: 0 = main_game, 8 = remake, 9 = remaster
const ALLOWED_CATEGORIES = new Set([0, 8, 9]);

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
}

export async function searchGames(query: string): Promise<IgdbSearchResult[]> {
  const token = await getAccessToken();
  if (!token || !env.igdbClientId) return [];

  // Apicalypse syntax. Escape quotes in the user query.
  const safeQuery = query.replace(/"/g, "");
  const body = `search "${safeQuery}"; ` + `fields name, category, cover.image_id; ` + `limit 25;`;

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
    // IGDB doesn't reliably combine `search` with `where` clauses — filter client-side.
    return data
      .filter((g) => g.category === undefined || ALLOWED_CATEGORIES.has(g.category))
      .slice(0, 10)
      .map((g) => ({
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
