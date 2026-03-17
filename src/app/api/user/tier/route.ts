import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { Users } from "@/lib/db/repo";
import { UserTier } from "@/types";
import { getOrCreateUserId } from "@/lib/services/session";

// TODO: clean up — dev-only tier toggle; remove or gate behind env flag before any public deploy
/** POST /api/user/tier — Toggle the current user's tier between Bard and Maestro. Dev-only. */
export async function POST() {
  try {
    const cookieStore = await cookies();
    const userId = await getOrCreateUserId(cookieStore);
    Users.getOrCreate(userId);

    const current = Users.getTier(userId);
    const next = current === UserTier.Maestro ? UserTier.Bard : UserTier.Maestro;
    Users.setTier(userId, next);

    return NextResponse.json({ tier: next });
  } catch (err) {
    console.error("[tier toggle]", err);
    return NextResponse.json({ error: "Failed to toggle tier" }, { status: 500 });
  }
}
