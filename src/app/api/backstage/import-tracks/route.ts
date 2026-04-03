import { Games, Tracks } from "@/lib/db/repo";
import { GAME_MAX_TRACKS } from "@/lib/constants";
import { NextResponse } from "next/server";
import { z } from "zod/v4";
import { zodErrorResponse } from "@/lib/validation";

const importTracksSchema = z.object({
  gameId: z.string().min(1),
  tracks: z
    .array(
      z.object({
        name: z.string().min(1),
        position: z.number().int().positive(),
        durationSeconds: z.number().int().positive().nullable().optional(),
      }),
    )
    .min(1)
    .max(GAME_MAX_TRACKS),
});

/** POST /api/backstage/import-tracks — bulk-import tracks from any source (paste, etc.) */
export async function POST(req: Request) {
  const body = await req.json();
  const parsed = importTracksSchema.safeParse(body);
  if (!parsed.success) return zodErrorResponse(parsed.error);

  const { gameId, tracks } = parsed.data;

  const game = await Games.getById(gameId);
  if (!game) {
    return NextResponse.json({ error: "Game not found" }, { status: 404 });
  }

  await Tracks.upsertBatch(
    tracks.map((t) => ({
      gameId,
      name: t.name,
      position: t.position,
      durationSeconds: t.durationSeconds ?? null,
    })),
  );

  return NextResponse.json({ imported: tracks.length });
}
