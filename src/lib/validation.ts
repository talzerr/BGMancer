import { z } from "zod/v4";
import { NextResponse } from "next/server";
import { CurationMode, OnboardingPhase, PlaylistMode } from "@/types";
import { MAX_TRACK_COUNT, SESSION_NAME_MAX_LENGTH, GAME_TITLE_MAX_LENGTH } from "@/lib/constants";
import { sanitizeGameTitle } from "@/lib/utils";
import { parseSteamInput } from "@/lib/services/external/steam-input";

// ─── Shared helpers ──────────────────────────────────────────────────────────

export function zodErrorResponse(error: z.ZodError): NextResponse {
  // Full detail logged server-side; client gets a generic 400 to avoid leaking field paths.
  console.warn("[validation] request body failed schema", z.prettifyError(error));
  return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
}

// ─── Game title ─────────────────────────────────────────────────────────────

export const gameTitleSchema = z
  .string()
  .transform(sanitizeGameTitle)
  .pipe(z.string().min(1, "Title must not be empty").max(GAME_TITLE_MAX_LENGTH));

// ─── Schemas ────────────────────────────────────────────────────────────────

const curationEnum = z.enum(Object.values(CurationMode) as [CurationMode, ...CurationMode[]]);

const addCurationEnum = z.enum([CurationMode.Focus, CurationMode.Include, CurationMode.Lite]);

export const addGameSchema = z.object({
  gameId: z.string().min(1),
  curation: addCurationEnum.optional(),
});

export const updateCurationSchema = z.object({
  curation: curationEnum,
});

export const renameSessionSchema = z.object({
  name: z.string().trim().min(1).max(SESSION_NAME_MAX_LENGTH),
});

// Delegates URL-shape validation to parseSteamInput so schema and service agree.
export const steamSyncSchema = z.object({
  steamUrl: z
    .string()
    .optional()
    .refine(
      (v) => {
        if (!v) return true;
        try {
          parseSteamInput(v);
          return true;
        } catch {
          return false;
        }
      },
      { message: "Couldn't find a Steam profile. Check the URL and try again." },
    ),
});

const gameSelectionSchema = z.object({
  gameId: z.string().min(1),
  curation: curationEnum.optional(),
});

const playlistModeEnum = z.enum(Object.values(PlaylistMode) as [PlaylistMode, ...PlaylistMode[]]);

export const generateSchema = z.object({
  target_track_count: z.number().int().min(1).max(MAX_TRACK_COUNT).optional(),
  allow_long_tracks: z.boolean().optional(),
  allow_short_tracks: z.boolean().optional(),
  anti_spoiler_enabled: z.boolean().optional(),
  playlist_mode: playlistModeEnum.optional(),
  gameSelections: z.array(gameSelectionSchema).optional(),
  turnstileToken: z.string().optional(),
});

export const rerollSchema = z.object({
  allowLongTracks: z.boolean().optional(),
  allowShortTracks: z.boolean().optional(),
});

// ─── Game requests (catalog "can't find your game?") ────────────────────────

export const igdbSearchQuerySchema = z.object({
  q: z.string().trim().min(1).max(100),
});

const IGDB_COVER_HOST = "images.igdb.com";

export const gameRequestSchema = z.object({
  igdbId: z.number().int().positive(),
  name: z.string().trim().min(1).max(200),
  // Host-lock at validation time so the DB never stores non-IGDB origins, even if CSP relaxes later.
  coverUrl: z
    .string()
    .url()
    .refine(
      (v) => {
        try {
          return new URL(v).hostname === IGDB_COVER_HOST;
        } catch {
          return false;
        }
      },
      { message: `Cover URL must point to ${IGDB_COVER_HOST}` },
    )
    .nullable(),
  turnstileToken: z.string(),
});

export const acknowledgeGameRequestSchema = z.object({
  igdbId: z.number().int().positive(),
});

// ─── Backstage / admin schemas ──────────────────────────────────────────────

export const gameIdBodySchema = z.object({
  gameId: z.string().min(1),
});

export const reviewFlagsDeleteSchema = z.object({
  gameId: z.string().min(1),
  flagId: z.number().int().positive().optional(),
});

export const publishSchema = z.object({
  gameId: z.string().min(1),
  published: z.boolean(),
});

export const bulkPublishSchema = z.object({
  gameIds: z.array(z.string().min(1)).min(1),
  published: z.boolean(),
});

export const tracksPostSchema = z.object({
  gameId: z.string().min(1),
  name: z.string().min(1),
  position: z.number().int().nonnegative().optional(),
});

const trackPatchSchema = z.object({
  gameId: z.string().min(1),
  name: z.string().min(1),
  updates: z.object({
    name: z.string().optional(),
    active: z.boolean().optional(),
    energy: z.number().int().nullable().optional(),
    roles: z.string().nullable().optional(),
    moods: z.string().nullable().optional(),
    instrumentation: z.string().nullable().optional(),
    hasVocals: z.boolean().nullable().optional(),
  }),
  videoUpdates: z
    .object({
      videoId: z.string().min(1),
      durationSeconds: z.number().int().nullable().optional(),
      viewCount: z.number().int().nullable().optional(),
    })
    .optional(),
});

export const tracksPatchSchema = z.union([trackPatchSchema, z.array(trackPatchSchema)]);

export const tracksDeleteSchema = z.union([
  z.object({
    keys: z.array(z.object({ gameId: z.string().min(1), name: z.string().min(1) })).min(1),
  }),
  z.object({ gameId: z.string().min(1), names: z.array(z.string().min(1)).min(1) }),
]);

export const tracksReviewSchema = z.object({
  gameId: z.string().min(1),
  approve: z.array(z.string().min(1)).optional(),
  reject: z.array(z.string().min(1)).optional(),
});

export const selectedTrackNamesSchema = z.object({
  gameId: z.string().min(1),
  trackNames: z.array(z.string().min(1)).min(1),
});

export const createGameSchema = z.object({
  title: gameTitleSchema,
  steamAppid: z.number().int().positive().nullable().optional(),
});

export const updateGameSchema = z.object({
  title: gameTitleSchema.optional(),
  steam_appid: z.number().int().positive().nullable().optional(),
  tracklist_source: z.string().nullable().optional(),
  yt_playlist_id: z.string().nullable().optional(),
  thumbnail_url: z.string().nullable().optional(),
  onboarding_phase: z.nativeEnum(OnboardingPhase).optional(),
});
