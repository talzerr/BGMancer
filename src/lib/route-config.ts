/**
 * Declarative route auth config — the single source of truth for all accessible routes.
 *
 * Every route (page and API) must be listed here to be accessible.
 * Unlisted routes are blocked with 404 by the proxy.
 *
 * API routes are keyed as "METHOD /path" (supports different auth per method).
 * Page routes are keyed as "/path" (always GET).
 * Wildcard "/path/*" matches all sub-paths.
 */

export enum AuthLevel {
  /** No auth needed. */
  Public = "public",
  /** Auth resolved — userId passed as string | null. */
  Optional = "optional",
  /** Must be logged in — 401 otherwise. */
  Required = "required",
  /** Backstage — gated by Cloudflare Access in production, open in dev. */
  Admin = "admin",
}

interface RouteEntry {
  auth: AuthLevel;
}

export const routeConfig: Record<string, RouteEntry> = {
  // ── Pages ──────────────────────────────────────────────────
  "/": { auth: AuthLevel.Public },
  "/catalog": { auth: AuthLevel.Public }, // Renders empty for guests — auth resolved client-side
  "/legal": { auth: AuthLevel.Public },
  "/backstage": { auth: AuthLevel.Admin },
  "/backstage/games": { auth: AuthLevel.Admin },
  "/backstage/games/[slug]": { auth: AuthLevel.Admin },
  "/backstage/tracks": { auth: AuthLevel.Admin },
  "/backstage/theatre": { auth: AuthLevel.Admin },

  // ── API: Auth ──────────────────────────────────────────────
  "/api/auth/*": { auth: AuthLevel.Public },

  // ── API: Games ─────────────────────────────────────────────
  "GET /api/games": { auth: AuthLevel.Optional },
  "POST /api/games": { auth: AuthLevel.Required },
  "PATCH /api/games": { auth: AuthLevel.Required },
  "DELETE /api/games": { auth: AuthLevel.Required },
  "GET /api/games/catalog": { auth: AuthLevel.Public },

  // ── API: Favorites ─────────────────────────────────────────
  "GET /api/favorites": { auth: AuthLevel.Optional },
  "POST /api/favorites": { auth: AuthLevel.Required },

  // ── API: Playlist ──────────────────────────────────────────
  "GET /api/playlist": { auth: AuthLevel.Optional },
  "DELETE /api/playlist": { auth: AuthLevel.Required },
  "PATCH /api/playlist": { auth: AuthLevel.Optional },
  "POST /api/playlist/generate": { auth: AuthLevel.Optional },
  "POST /api/playlist/import": { auth: AuthLevel.Optional },
  "DELETE /api/playlist/[id]": { auth: AuthLevel.Required },
  "POST /api/playlist/[id]/reroll": { auth: AuthLevel.Required },

  // ── API: Sessions ──────────────────────────────────────────
  "GET /api/sessions": { auth: AuthLevel.Optional },
  "PATCH /api/sessions/[id]": { auth: AuthLevel.Required },
  "DELETE /api/sessions/[id]": { auth: AuthLevel.Required },

  // ── API: Steam (admin — used by Backstage for game onboarding) ──
  "GET /api/steam/games": { auth: AuthLevel.Admin },
  "GET /api/steam/search": { auth: AuthLevel.Admin },
  "POST /api/steam/import": { auth: AuthLevel.Admin },

  // ── API: Sync ──────────────────────────────────────────────
  "POST /api/sync": { auth: AuthLevel.Required },

  // ── API: Backstage ─────────────────────────────────────────
  "/api/backstage/*": { auth: AuthLevel.Admin },
};
