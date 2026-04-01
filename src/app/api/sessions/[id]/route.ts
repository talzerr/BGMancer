import { NextResponse } from "next/server";
import { Sessions } from "@/lib/db/repo";
import { withRequiredAuth } from "@/lib/services/route-wrappers";
import { renameSessionSchema, zodErrorResponse } from "@/lib/validation";

/** PATCH /api/sessions/:id — Rename a session. Body: { name: string }. */
export const PATCH = withRequiredAuth(
  async (userId, req: Request, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;

    const parsed = renameSessionSchema.safeParse(await req.json());
    if (!parsed.success) return zodErrorResponse(parsed.error);

    const session = await Sessions.getById(id);
    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }
    if (session.user_id !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await Sessions.rename(id, parsed.data.name);
    return NextResponse.json({ success: true });
  },
  "PATCH /api/sessions/[id]",
);

/** DELETE /api/sessions/:id — Delete a session. Returns the next most recent session ID. */
export const DELETE = withRequiredAuth(
  async (userId, _req: Request, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;

    const session = await Sessions.getById(id);
    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }
    if (session.user_id !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await Sessions.delete(id);

    // Return the next most recent session so the client can switch to it.
    const next = await Sessions.getActive(userId);
    return NextResponse.json({ success: true, nextSessionId: next?.id ?? null });
  },
  "DELETE /api/sessions/[id]",
);
