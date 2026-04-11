import { z } from "zod/v4";
import { NextResponse } from "next/server";
import { CurationMode, PlaylistMode } from "@/types";
import { MAX_TRACK_COUNT, SESSION_NAME_MAX_LENGTH, GAME_TITLE_MAX_LENGTH } from "@/lib/constants";
import { sanitizeGameTitle } from "@/lib/utils";
import { parseSteamInput } from "@/lib/services/external/steam-input";

// ─── Shared helpers ──────────────────────────────────────────────────────────

export function zodErrorResponse(error: z.ZodError): NextResponse {
  return NextResponse.json({ error: z.prettifyError(error) }, { status: 400 });
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

// ─── YouTube sync ────────────────────────────────────────────────────────────

export const syncRequestSchema = z.object({
  sessionId: z.string().min(1),
});

// ─── Game requests (catalog "can't find your game?") ────────────────────────

export const igdbSearchQuerySchema = z.object({
  q: z.string().trim().min(1).max(100),
});

export const gameRequestSchema = z.object({
  igdbId: z.number().int().positive(),
  name: z.string().trim().min(1).max(200),
  coverUrl: z.string().url().nullable(),
  turnstileToken: z.string(),
});

export const acknowledgeGameRequestSchema = z.object({
  igdbId: z.number().int().positive(),
});
