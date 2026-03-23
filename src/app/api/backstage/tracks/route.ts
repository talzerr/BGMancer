import { Tracks } from "@/lib/db/repo";
import { NextResponse } from "next/server";

/** GET /api/backstage/tracks — search tracks with optional filters */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const gameId = url.searchParams.get("gameId") ?? undefined;
  const gameTitle = url.searchParams.get("gameTitle") ?? undefined;
  const name = url.searchParams.get("name") ?? undefined;
  const energy = url.searchParams.get("energy");
  const active = url.searchParams.get("active");
  const untaggedOnly = url.searchParams.get("untaggedOnly") === "1";

  const tracks = Tracks.searchWithVideoIds({
    gameId,
    gameTitle,
    name,
    energy: energy ? Number(energy) : undefined,
    active: active != null ? active === "1" : undefined,
    untaggedOnly,
  });
  return NextResponse.json(tracks);
}

interface TrackPatch {
  gameId: string;
  name: string;
  updates: {
    name?: string;
    active?: boolean;
    energy?: number | null;
    role?: string | null;
    moods?: string | null;
    instrumentation?: string | null;
    hasVocals?: boolean | null;
  };
}

/** PATCH /api/backstage/tracks — update one or many tracks */
export async function PATCH(req: Request) {
  const body = (await req.json()) as TrackPatch | TrackPatch[];
  const patches = Array.isArray(body) ? body : [body];

  for (const patch of patches) {
    Tracks.updateFields(patch.gameId, patch.name, {
      newName: patch.updates.name,
      active: patch.updates.active,
      energy: patch.updates.energy,
      role: patch.updates.role,
      moods: patch.updates.moods,
      instrumentation: patch.updates.instrumentation,
      hasVocals: patch.updates.hasVocals,
    });
  }

  return NextResponse.json({ ok: true });
}

/** POST /api/backstage/tracks — create a manual track */
export async function POST(req: Request) {
  const { gameId, name, position } = (await req.json()) as {
    gameId: string;
    name: string;
    position?: number;
  };

  if (!gameId || !name) {
    return NextResponse.json({ error: "gameId and name are required" }, { status: 400 });
  }

  Tracks.upsertBatch([{ gameId, name, position: position ?? 0 }]);
  return NextResponse.json({ ok: true }, { status: 201 });
}

/** DELETE /api/backstage/tracks — delete tracks by composite PK */
export async function DELETE(req: Request) {
  const body = (await req.json()) as
    | { gameId: string; names: string[] }
    | { keys: { gameId: string; name: string }[] };

  if ("keys" in body) {
    Tracks.deleteByKeys(body.keys);
  } else if (body.gameId && Array.isArray(body.names)) {
    Tracks.deleteByKeys(body.names.map((name) => ({ gameId: body.gameId, name })));
  } else {
    return NextResponse.json({ error: "Provide {keys} or {gameId, names}" }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
