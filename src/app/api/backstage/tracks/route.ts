import { Tracks, VideoTracks } from "@/lib/db/repo";
import { withAdminAuth } from "@/lib/services/auth/admin-wrapper";
import {
  tracksPatchSchema,
  tracksPostSchema,
  tracksDeleteSchema,
  zodErrorResponse,
} from "@/lib/validation";
import { ensureVideoMetadata } from "@/lib/pipeline/onboarding/youtube-resolve";
import { NextResponse } from "next/server";
import { createLogger } from "@/lib/logger";

const log = createLogger("backstage-tracks");

/** GET /api/backstage/tracks — search tracks with optional filters */
export const GET = withAdminAuth(async (req: Request) => {
  try {
    const url = new URL(req.url);
    const gameId = url.searchParams.get("gameId") ?? undefined;
    const gameTitle = url.searchParams.get("gameTitle") ?? undefined;
    const name = url.searchParams.get("name") ?? undefined;
    const energy = url.searchParams.get("energy");
    const active = url.searchParams.get("active");
    const untaggedOnly = url.searchParams.get("untaggedOnly") === "1";

    const tracks = await Tracks.searchWithVideoIds({
      gameId,
      gameTitle,
      name,
      energy: energy ? Number(energy) : undefined,
      active: active != null ? active === "1" : undefined,
      untaggedOnly,
    });
    return NextResponse.json(tracks);
  } catch (err) {
    log.error("handler failed", {}, err);
    return NextResponse.json({ error: "Failed to query tracks" }, { status: 500 });
  }
}, "backstage-tracks");

interface TrackPatch {
  gameId: string;
  name: string;
  updates: {
    name?: string;
    active?: boolean;
    energy?: number | null;
    roles?: string | null;
    moods?: string | null;
    instrumentation?: string | null;
    hasVocals?: boolean | null;
  };
  videoUpdates?: {
    videoId: string;
    durationSeconds?: number | null;
    viewCount?: number | null;
  };
}

/** PATCH /api/backstage/tracks — update one or many tracks */
export const PATCH = withAdminAuth(async (req: Request) => {
  const parsed = tracksPatchSchema.safeParse(await req.json());
  if (!parsed.success) return zodErrorResponse(parsed.error);
  const body = parsed.data as TrackPatch | TrackPatch[];

  try {
    const patches = Array.isArray(body) ? body : [body];

    // Fast path: uniform active-only updates for one game → single bulk query
    const isBulkActive =
      patches.length > 1 &&
      patches.every(
        (p) =>
          p.gameId === patches[0].gameId &&
          p.updates.active !== undefined &&
          Object.keys(p.updates).length === 1 &&
          !p.videoUpdates,
      );

    if (isBulkActive) {
      await Tracks.bulkSetActive(
        patches[0].gameId,
        patches.map((p) => p.name),
        patches[0].updates.active ?? true,
      );
    } else {
      for (const patch of patches) {
        await Tracks.updateFields(patch.gameId, patch.name, {
          newName: patch.updates.name,
          active: patch.updates.active,
          energy: patch.updates.energy,
          roles: patch.updates.roles,
          moods: patch.updates.moods,
          instrumentation: patch.updates.instrumentation,
          hasVocals: patch.updates.hasVocals,
        });

        if (patch.videoUpdates?.videoId) {
          await VideoTracks.upsertSingle(patch.gameId, patch.name, patch.videoUpdates);
          if (patch.videoUpdates.durationSeconds == null) {
            await ensureVideoMetadata([patch.videoUpdates.videoId], patch.gameId);
          }
        }
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    log.error("handler failed", {}, err);
    return NextResponse.json({ error: "Failed to update tracks" }, { status: 500 });
  }
}, "backstage-tracks");

/** POST /api/backstage/tracks — create a manual track */
export const POST = withAdminAuth(async (req: Request) => {
  const parsed = tracksPostSchema.safeParse(await req.json());
  if (!parsed.success) return zodErrorResponse(parsed.error);
  const { gameId, name, position } = parsed.data;

  try {
    await Tracks.upsertBatch([{ gameId, name, position: position ?? 0 }]);
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (err) {
    log.error("handler failed", {}, err);
    return NextResponse.json({ error: "Failed to create track" }, { status: 500 });
  }
}, "backstage-tracks");

/** DELETE /api/backstage/tracks — delete tracks by composite PK */
export const DELETE = withAdminAuth(async (req: Request) => {
  const parsed = tracksDeleteSchema.safeParse(await req.json());
  if (!parsed.success) return zodErrorResponse(parsed.error);
  const body = parsed.data;

  try {
    if ("keys" in body) {
      await Tracks.deleteByKeys(body.keys);
    } else {
      await Tracks.deleteByKeys(body.names.map((name) => ({ gameId: body.gameId, name })));
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    log.error("handler failed", {}, err);
    return NextResponse.json({ error: "Failed to delete tracks" }, { status: 500 });
  }
}, "backstage-tracks");
