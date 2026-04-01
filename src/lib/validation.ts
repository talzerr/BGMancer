import { z } from "zod/v4";
import { NextResponse } from "next/server";
import { CurationMode } from "@/types";
import { MAX_TRACK_COUNT, SESSION_NAME_MAX_LENGTH } from "@/lib/constants";

// ─── Shared helpers ──────────────────────────────────────────────────────────

export function zodErrorResponse(error: z.ZodError): NextResponse {
  return NextResponse.json({ error: z.prettifyError(error) }, { status: 400 });
}

// ─── Schemas ─────────────────────────────────────────────────────────────────

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

export const reorderSchema = z.object({
  orderedIds: z.array(z.string().min(1)),
});

export const importPlaylistSchema = z.object({
  url: z.string().min(1),
});

export const gameSelectionSchema = z.object({
  gameId: z.string().min(1),
  curation: curationEnum.optional(),
});

export const generateSchema = z.object({
  target_track_count: z.number().int().min(1).max(MAX_TRACK_COUNT).optional(),
  allow_long_tracks: z.boolean().optional(),
  allow_short_tracks: z.boolean().optional(),
  anti_spoiler_enabled: z.boolean().optional(),
  raw_vibes: z.boolean().optional(),
  gameSelections: z.array(gameSelectionSchema).optional(),
});

export const rerollSchema = z.object({
  allowLongTracks: z.boolean().optional(),
  allowShortTracks: z.boolean().optional(),
});
