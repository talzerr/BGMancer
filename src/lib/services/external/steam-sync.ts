/**
 * Steam library sync service.
 *
 * Owns all Steam Web API calls (vanity resolution + GetOwnedGames), the
 * per-user sync cooldown, the top-N cap, and atomic batch persistence.
 * Route handlers are thin wrappers that call `syncUserLibrary()` and map
 * the typed error classes exported here to HTTP responses.
 */
import { eq } from "drizzle-orm";
import { getDB, batch } from "@/lib/db";
import { users } from "@/lib/db/drizzle-schema";
import { Users, UserSteamGames } from "@/lib/db/repo";
import { env } from "@/lib/env";
import { createLogger } from "@/lib/logger";

const log = createLogger("steam-sync");

// ─── Constants ───────────────────────────────────────────────────────────────

const STEAM_SYNC_COOLDOWN_MS = 60 * 60 * 1000; // 1 hour
const MAX_SYNCED_GAMES = 500;

// ─── Typed errors ────────────────────────────────────────────────────────────

export class SteamApiError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "SteamApiError";
  }
}

export class PrivateProfileError extends Error {
  constructor(message = "Steam profile is private or has no games.") {
    super(message);
    this.name = "PrivateProfileError";
  }
}

export class InvalidSteamUrlError extends Error {
  constructor(message = "Couldn't find a Steam profile. Check the URL and try again.") {
    super(message);
    this.name = "InvalidSteamUrlError";
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

export type ParsedSteamInput =
  | { kind: "vanity"; value: string }
  | { kind: "profile"; value: string }
  | { kind: "id"; value: string };

/**
 * Parses a user-supplied Steam profile URL or bare SteamID64.
 * Throws `InvalidSteamUrlError` for anything that doesn't clearly match.
 */
export function parseSteamInput(input: string): ParsedSteamInput {
  const trimmed = input.trim().replace(/\/+$/, "");
  if (!trimmed) throw new InvalidSteamUrlError();

  // Bare 17-digit numeric → SteamID64
  if (/^\d{17}$/.test(trimmed)) {
    return { kind: "id", value: trimmed };
  }

  // steamcommunity.com/profiles/<numericId>
  const profileMatch = trimmed.match(/steamcommunity\.com\/profiles\/(\d{17})(?:[/?#].*)?$/);
  if (profileMatch) {
    return { kind: "profile", value: profileMatch[1] };
  }

  // steamcommunity.com/id/<vanity>
  const vanityMatch = trimmed.match(/steamcommunity\.com\/id\/([^/?#]+)/);
  if (vanityMatch) {
    return { kind: "vanity", value: vanityMatch[1] };
  }

  throw new InvalidSteamUrlError();
}

/** Calls Steam's ResolveVanityURL endpoint. */
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

/** Calls Steam's GetOwnedGames endpoint. */
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
    response?: { games?: Array<{ appid: number; playtime_forever: number }> };
  };
  const games = data.response?.games;
  if (!games || games.length === 0) {
    throw new PrivateProfileError();
  }
  return games.map((g) => ({ appid: g.appid, playtime_forever: g.playtime_forever }));
}

// ─── Main entry point ───────────────────────────────────────────────────────

export interface SyncResult {
  totalSynced: number;
  catalogMatches: number;
  steamSyncedAt: string;
}

/**
 * Syncs a user's Steam library.
 *
 * On first sync the caller must pass `opts.steamUrl`. Subsequent syncs reuse
 * the stored `steam_id` and enforce a 1-hour cooldown. The user's full Steam
 * game set is replaced atomically with the top-500 games by playtime.
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
    // Should never happen — caller enforced auth — but fail loudly rather than silently.
    throw new SteamApiError(`User ${userId} not found`);
  }

  const now = opts.now ?? new Date();

  // 1. Resolve / re-use steam_id and handle cooldown
  let steamId: string;
  let storingFreshSteamId = false;

  if (user.steam_id) {
    steamId = user.steam_id;
    if (user.steam_synced_at) {
      const lastSynced = new Date(user.steam_synced_at).getTime();
      const elapsedMs = now.getTime() - lastSynced;
      if (elapsedMs < STEAM_SYNC_COOLDOWN_MS) {
        const elapsedSeconds = Math.floor(elapsedMs / 1000);
        const minutesRemaining = Math.ceil((3600 - elapsedSeconds) / 60);
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

  // 2. Fetch owned games from Steam
  const owned = await fetchOwnedGames(steamId, apiKey);

  // 3. Cap to top-500 by playtime
  const topGames = [...owned]
    .sort((a, b) => b.playtime_forever - a.playtime_forever)
    .slice(0, MAX_SYNCED_GAMES)
    .map((g) => ({ steamAppId: g.appid, playtimeMinutes: g.playtime_forever }));

  // 4. Atomic batch: replace user_steam_games + update users timestamp (+ steam_id on first sync)
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

  // 5. Count catalog matches (after the write so the read sees the new set)
  const catalogMatches = await UserSteamGames.countMatches(userId);

  return {
    totalSynced: topGames.length,
    catalogMatches,
    steamSyncedAt,
  };
}
