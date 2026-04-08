/**
 * Pure parser split out from steam-sync.ts so validation.ts can import it
 * without pulling in env, db, logger, and drizzle.
 */

export class InvalidSteamUrlError extends Error {
  constructor(message = "Couldn't find a Steam profile. Check the URL and try again.") {
    super(message);
    this.name = "InvalidSteamUrlError";
  }
}

export type ParsedSteamInput =
  | { kind: "vanity"; value: string }
  | { kind: "profile"; value: string }
  | { kind: "id"; value: string };

/** Parses a Steam profile URL or bare SteamID64. Throws `InvalidSteamUrlError` on no match. */
export function parseSteamInput(input: string): ParsedSteamInput {
  const trimmed = input.trim().replace(/\/+$/, "");
  if (!trimmed) throw new InvalidSteamUrlError();

  if (/^\d{17}$/.test(trimmed)) {
    return { kind: "id", value: trimmed };
  }

  const profileMatch = trimmed.match(/steamcommunity\.com\/profiles\/(\d{17})(?:[/?#].*)?$/);
  if (profileMatch) {
    return { kind: "profile", value: profileMatch[1] };
  }

  const vanityMatch = trimmed.match(/steamcommunity\.com\/id\/([^/?#]+)/);
  if (vanityMatch) {
    return { kind: "vanity", value: vanityMatch[1] };
  }

  throw new InvalidSteamUrlError();
}
