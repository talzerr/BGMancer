import { NextResponse } from "next/server";

// [WALLED_GARDEN] Steam import is disabled. Games are onboarded via Backstage.
// The original handler bulk-imported Steam games, created game records, and triggered
// onboardGame() for each. See git history for the full implementation.

/**
 * POST /api/steam/import — DISABLED
 *
 * Steam import is disabled in the walled garden model. Games must be created
 * and onboarded through Backstage before users can add them to their library.
 */
export async function POST() {
  return NextResponse.json(
    { error: "Steam import is disabled. Games are managed through Backstage." },
    { status: 403 },
  );
}
