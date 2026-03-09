import { NextResponse } from "next/server";
import { Sessions } from "@/lib/db/repo";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { name } = (await req.json()) as { name?: string };

    if (!name?.trim()) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    if (!Sessions.getById(id)) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    Sessions.rename(id, name.trim());
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[PATCH /api/sessions/[id]]", err);
    return NextResponse.json({ error: "Failed to rename session" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    if (!Sessions.getById(id)) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    Sessions.delete(id);

    // Return the next most recent session so the client can switch to it.
    const next = Sessions.getActive();
    return NextResponse.json({ success: true, nextSessionId: next?.id ?? null });
  } catch (err) {
    console.error("[DELETE /api/sessions/[id]]", err);
    return NextResponse.json({ error: "Failed to delete session" }, { status: 500 });
  }
}
