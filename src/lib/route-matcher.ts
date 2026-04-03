/**
 * Route matching logic for the proxy.
 *
 * Matches incoming requests against the route config allowlist.
 * Supports:
 *   - Exact paths: "/api/games/catalog"
 *   - Dynamic segments: "/api/sessions/[id]" matches "/api/sessions/abc123"
 *   - Wildcards: "/api/backstage/*" matches "/api/backstage/anything/nested"
 *   - Method-specific API routes: "GET /api/games" vs "POST /api/games"
 *   - Page routes (no method prefix): "/catalog"
 */

import { routeConfig, type AuthLevel } from "./route-config";

interface MatchResult {
  auth: AuthLevel;
}

/** Parsed config entry — built once at startup. */
interface ParsedRoute {
  method: string | null; // null = any method (pages, wildcards)
  segments: string[]; // path segments, e.g. ["api", "games"]
  isWildcard: boolean; // ends with *
  auth: AuthLevel;
}

const parsedRoutes: ParsedRoute[] = Object.entries(routeConfig).map(([key, entry]) => {
  // Split "METHOD /path" or just "/path"
  const spaceIdx = key.indexOf(" ");
  let method: string | null = null;
  let path: string;

  if (spaceIdx > 0 && !key.startsWith("/")) {
    method = key.slice(0, spaceIdx).toUpperCase();
    path = key.slice(spaceIdx + 1);
  } else {
    path = key;
  }

  const isWildcard = path.endsWith("/*");
  const cleanPath = isWildcard ? path.slice(0, -2) : path;
  const segments = cleanPath.split("/").filter(Boolean);

  return { method, segments, isWildcard, auth: entry.auth };
});

function segmentMatches(pattern: string, actual: string): boolean {
  // Dynamic segments: [id], [slug], [...nextauth]
  if (pattern.startsWith("[")) return true;
  return pattern === actual;
}

/**
 * Match a request against the route config.
 * Returns the auth level if matched, or null if the route is not registered.
 */
export function matchRoute(method: string, pathname: string): MatchResult | null {
  const segments = pathname.split("/").filter(Boolean);

  for (const route of parsedRoutes) {
    // Method check: if route specifies a method, it must match
    if (route.method && route.method !== method.toUpperCase()) continue;

    if (route.isWildcard) {
      // Wildcard: route segments must be a prefix of the actual path
      if (segments.length < route.segments.length) continue;
      const prefixMatches = route.segments.every((seg, i) => segmentMatches(seg, segments[i]));
      if (prefixMatches) return { auth: route.auth };
    } else {
      // Exact match: same number of segments, each must match
      if (segments.length !== route.segments.length) continue;
      const allMatch = route.segments.every((seg, i) => segmentMatches(seg, segments[i]));
      if (allMatch) return { auth: route.auth };
    }
  }

  return null;
}
