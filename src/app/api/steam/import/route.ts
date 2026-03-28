import { NextResponse } from "next/server";

/** POST /api/steam/import — disabled; games are onboarded through Backstage. */
export async function POST() {
  return NextResponse.json(
    { error: "Steam import is disabled. Games are managed through Backstage." },
    { status: 403 },
  );
}
