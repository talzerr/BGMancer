import { Tracks } from "@/lib/db/repo";
import { NextResponse } from "next/server";

/** POST /api/backstage/tracks/review — batch approve/reject discovered tracks */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      gameId: string;
      approve?: string[];
      reject?: string[];
    };

    if (!body.gameId) {
      return NextResponse.json({ error: "gameId is required" }, { status: 400 });
    }

    if (body.approve?.length) {
      await Tracks.approveDiscovered(body.gameId, body.approve);
    }
    if (body.reject?.length) {
      await Tracks.rejectDiscovered(body.gameId, body.reject);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[POST /api/backstage/tracks/review]", err);
    return NextResponse.json({ error: "Failed to review tracks" }, { status: 500 });
  }
}
