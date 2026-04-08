/**
 * Owns all Steam Web API calls, the per-user sync cooldown, the top-N cap,
 * and the atomic batch persistence. Route handlers map the typed errors
 * exported here to HTTP responses.
 */
import { eq } from "drizzle-orm";
import { getDB, batch } from "@/lib/db";
import { users } from "@/lib/db/drizzle-schema";
import { Users, UserSteamGames } from "@/lib/db/repo";
import { env } from "@/lib/env";
import { createLogger } from "@/lib/logger";
import { STEAM_SYNC_COOLDOWN_MS, STEAM_SYNC_MAX_GAMES } from "@/lib/constants";
import { InvalidSteamUrlError, parseSteamInput, type ParsedSteamInput } from "./steam-input";

export { InvalidSteamUrlError, parseSteamInput, type ParsedSteamInput };

const log = createLogger("steam-sync");

// ─── Typed errors ────────────────────────────────────────────────────────────

export class SteamApiError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "SteamApiError";
  }
}

export class PrivateProfileError extends Error {
  constructor(
    message = "Steam profile game details are private. Set them to public and try again.",
  ) {
    super(message);
    this.name = "PrivateProfileError";
  }
}

export class VanityNotFoundError extends Error {
  constructor(message = "Steam vanity URL could not be resolved.") {
    super(message);
    this.name = "VanityNotFoundError";
  }
}

export class CooldownError extends Error {
  public readonly minutesRemaining: number;
  constructor(minutesRemaining: number) {
    super(`Steam sync is on cooldown. Try again in ${minutesRemaining} minute(s).`);
    this.name = "CooldownError";
    this.minutesRemaining = minutesRemaining;
  }
}

export class MissingSteamUrlError extends Error {
  constructor(message = "A Steam profile URL is required on first sync.") {
    super(message);
    this.name = "MissingSteamUrlError";
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

export async function resolveVanityUrl(vanity: string, apiKey: string): Promise<string> {
  const url = `https://api.steampowered.com/ISteamUser/ResolveVanityURL/v1/?key=${apiKey}&vanityurl=${encodeURIComponent(vanity)}`;
  let res: Response;
  try {
    res = await fetch(url);
  } catch (err) {
    log.error("ResolveVanityURL fetch failed", { vanity }, err);
    throw new SteamApiError("Failed to reach Steam API", { cause: err });
  }
  if (!res.ok) {
    log.error("ResolveVanityURL non-OK", { vanity, status: res.status });
    throw new SteamApiError(`Steam API returned ${res.status}`);
  }
  const data = (await res.json()) as { response?: { success?: number; steamid?: string } };
  if (data.response?.success === 1 && data.response.steamid) {
    return data.response.steamid;
  }
  throw new VanityNotFoundError();
}

export async function fetchOwnedGames(
  steamId: string,
  apiKey: string,
): Promise<Array<{ appid: number; playtime_forever: number }>> {
  const url =
    `https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/` +
    `?key=${apiKey}&steamid=${steamId}&include_played_free_games=1&format=json`;

  let res: Response;
  try {
    res = await fetch(url);
  } catch (err) {
    log.error("GetOwnedGames fetch failed", { steamId }, err);
    throw new SteamApiError("Failed to reach Steam API", { cause: err });
  }
  if (!res.ok) {
    log.error("GetOwnedGames non-OK", { steamId, status: res.status });
    throw new SteamApiError(`Steam API returned ${res.status}`);
  }
  const data = (await res.json()) as {
    response?: {
      games?: Array<{ appid: number; playtime_forever: number }>;
      game_count?: number;
    };
  };
  // Steam returns `{response: {}}` for private profiles, `{response: {game_count: 0}}`
  // for public profiles with no games — only the former should error.
  const response = data.response;
  if (!response || (response.games === undefined && response.game_count === undefined)) {
    throw new PrivateProfileError();
  }
  const games = response.games ?? [];
  return games.map((g) => ({ appid: g.appid, playtime_forever: g.playtime_forever }));
}

// ─── Main entry point ───────────────────────────────────────────────────────

export interface SyncResult {
  totalSynced: number;
  catalogMatches: number;
  steamSyncedAt: string;
}

/**
 * On first sync the caller must pass `opts.steamUrl`. Subsequent syncs reuse
 * the stored `steam_id` and enforce the 1-hour cooldown. The user's Steam game
 * set is replaced atomically with the top-N by playtime.
 */
export async function syncUserLibrary(
  userId: string,
  opts: { steamUrl?: string; now?: Date } = {},
): Promise<SyncResult> {
  const apiKey = env.steamApiKey;
  if (!apiKey) {
    throw new SteamApiError("STEAM_API_KEY is not configured on the server.");
  }

  const user = await Users.getById(userId);
  if (!user) {
    throw new SteamApiError(`User ${userId} not found`);
  }

  const now = opts.now ?? new Date();

  let steamId: string;
  let storingFreshSteamId = false;

  if (user.steam_id) {
    steamId = user.steam_id;
    if (user.steam_synced_at) {
      const lastSynced = new Date(user.steam_synced_at).getTime();
      const elapsedMs = now.getTime() - lastSynced;
      if (elapsedMs < STEAM_SYNC_COOLDOWN_MS) {
        const minutesRemaining = Math.ceil((STEAM_SYNC_COOLDOWN_MS - elapsedMs) / 60_000);
        throw new CooldownError(minutesRemaining);
      }
    }
  } else {
    if (!opts.steamUrl) throw new MissingSteamUrlError();
    const parsed = parseSteamInput(opts.steamUrl);
    steamId =
      parsed.kind === "vanity" ? await resolveVanityUrl(parsed.value, apiKey) : parsed.value;
    storingFreshSteamId = true;
  }

  const owned = await fetchOwnedGames(steamId, apiKey);

  const topGames = [...owned]
    .sort((a, b) => b.playtime_forever - a.playtime_forever)
    .slice(0, STEAM_SYNC_MAX_GAMES)
    .map((g) => ({ steamAppId: g.appid, playtimeMinutes: g.playtime_forever }));

  const steamSyncedAt = now.toISOString();
  const replaceStmts = UserSteamGames.buildReplaceStatements(userId, topGames);
  const db = getDB();
  const userUpdate = storingFreshSteamId
    ? db
        .update(users)
        .set({ steam_id: steamId, steam_synced_at: steamSyncedAt })
        .where(eq(users.id, userId))
    : db.update(users).set({ steam_synced_at: steamSyncedAt }).where(eq(users.id, userId));

  await batch([...replaceStmts, userUpdate]);

  const matchedGameIds = await UserSteamGames.getMatchedGameIds(userId);

  return {
    totalSynced: topGames.length,
    catalogMatches: matchedGameIds.length,
    steamSyncedAt,
  };
}
