import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { Sessions } from "@/lib/db/repo";
import { getOrCreateUserId } from "@/lib/services/session";

/** PATCH /api/sessions/:id — Rename a session. Body: { name: string }. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { name } = (await req.json()) as { name?: string };

    if (!name?.trim()) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    if (!(await Sessions.getById(id))) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    await Sessions.rename(id, name.trim());
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[PATCH /api/sessions/[id]]", err);
    return NextResponse.json({ error: "Failed to rename session" }, { status: 500 });
  }
}

/** DELETE /api/sessions/:id — Delete a session. Returns the next most recent session ID. */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const cookieStore = await cookies();
    const userId = await getOrCreateUserId(cookieStore);

    const { id } = await params;

    if (!(await Sessions.getById(id))) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    await Sessions.delete(id);

    // Return the next most recent session so the client can switch to it.
    const next = await Sessions.getActive(userId);
    return NextResponse.json({ success: true, nextSessionId: next?.id ?? null });
  } catch (err) {
    console.error("[DELETE /api/sessions/[id]]", err);
    return NextResponse.json({ error: "Failed to delete session" }, { status: 500 });
  }
}
