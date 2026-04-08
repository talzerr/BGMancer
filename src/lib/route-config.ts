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
  "/backstage/requests": { auth: AuthLevel.Admin },

  // ── API: Auth ──────────────────────────────────────────────
  "/api/auth/*": { auth: AuthLevel.Public },

  // ── API: Games ─────────────────────────────────────────────
  "GET /api/games": { auth: AuthLevel.Optional },
  "POST /api/games": { auth: AuthLevel.Required },
  "PATCH /api/games": { auth: AuthLevel.Required },
  "DELETE /api/games": { auth: AuthLevel.Required },
  "GET /api/games/catalog": { auth: AuthLevel.Public },
  "GET /api/games/search-igdb": { auth: AuthLevel.Public },
  "POST /api/games/request": { auth: AuthLevel.Public },

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

  // ── API: Steam (user-facing — library sync) ────────────────
  "POST /api/steam/sync": { auth: AuthLevel.Required },
  "GET /api/steam/library": { auth: AuthLevel.Required },
  "DELETE /api/steam/link": { auth: AuthLevel.Required },

  // ── API: Sync ──────────────────────────────────────────────
  "POST /api/sync": { auth: AuthLevel.Required },

  // ── API: Backstage — Dashboard ─────────────────────────────
  "GET /api/backstage/dashboard": { auth: AuthLevel.Admin },

  // ── API: Backstage — Games ─────────────────────────────────
  "GET /api/backstage/games": { auth: AuthLevel.Admin },
  "POST /api/backstage/games": { auth: AuthLevel.Admin },
  "PATCH /api/backstage/games/[gameId]": { auth: AuthLevel.Admin },
  "DELETE /api/backstage/games/[gameId]": { auth: AuthLevel.Admin },
  "GET /api/backstage/games/[gameId]/tracks": { auth: AuthLevel.Admin },

  // ── API: Backstage — Tracks ────────────────────────────────
  "GET /api/backstage/tracks": { auth: AuthLevel.Admin },
  "POST /api/backstage/tracks": { auth: AuthLevel.Admin },
  "PATCH /api/backstage/tracks": { auth: AuthLevel.Admin },
  "DELETE /api/backstage/tracks": { auth: AuthLevel.Admin },
  "POST /api/backstage/tracks/review": { auth: AuthLevel.Admin },

  // ── API: Backstage — Onboarding pipeline ───────────────────
  "POST /api/backstage/load-tracks": { auth: AuthLevel.Admin },
  "POST /api/backstage/import-tracks": { auth: AuthLevel.Admin },
  "POST /api/backstage/resolve": { auth: AuthLevel.Admin },
  "POST /api/backstage/resolve-selected": { auth: AuthLevel.Admin },
  "POST /api/backstage/retag": { auth: AuthLevel.Admin },
  "POST /api/backstage/tag-selected": { auth: AuthLevel.Admin },
  "POST /api/backstage/reingest": { auth: AuthLevel.Admin },
  "POST /api/backstage/quick-onboard": { auth: AuthLevel.Admin },
  "POST /api/backstage/publish": { auth: AuthLevel.Admin },
  "POST /api/backstage/bulk-publish": { auth: AuthLevel.Admin },

  // ── API: Backstage — Review flags ──────────────────────────
  "DELETE /api/backstage/review-flags": { auth: AuthLevel.Admin },

  // ── API: Backstage — Steam (admin game onboarding) ─────────
  "GET /api/backstage/steam/games": { auth: AuthLevel.Admin },
  "GET /api/backstage/steam/search": { auth: AuthLevel.Admin },

  // ── API: Backstage — Theatre (Director telemetry) ──────────
  "GET /api/backstage/theatre/sessions": { auth: AuthLevel.Admin },
  "GET /api/backstage/theatre/[playlistId]": { auth: AuthLevel.Admin },

  // ── API: Backstage — Game requests ─────────────────────────
  "GET /api/backstage/requests": { auth: AuthLevel.Admin },
  "POST /api/backstage/requests/acknowledge": { auth: AuthLevel.Admin },
};
