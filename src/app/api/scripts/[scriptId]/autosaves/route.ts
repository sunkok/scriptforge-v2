import type { NextRequest } from "next/server";
import { readAutosavesIndex, deleteAutosavesIndex } from "@/lib/s3/autosave-index";

const UUID_RE = /^[a-f0-9-]{36}$/;

type Ctx = { params: Promise<{ scriptId: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { scriptId } = await ctx.params;
  if (!UUID_RE.test(scriptId)) {
    return Response.json({ error: "Invalid script ID" }, { status: 400 });
  }

  try {
    const index = await readAutosavesIndex(scriptId);
    const sorted = [...index.snapshots].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    return Response.json({ snapshots: sorted });
  } catch (err) {
    console.error("GET /api/scripts/[scriptId]/autosaves", err);
    return Response.json({ error: "Failed to load auto-saves" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const { scriptId } = await ctx.params;
  if (!UUID_RE.test(scriptId)) {
    return Response.json({ error: "Invalid script ID" }, { status: 400 });
  }

  try {
    await deleteAutosavesIndex(scriptId);
    return Response.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/scripts/[scriptId]/autosaves", err);
    return Response.json({ error: "Failed to reset auto-saves" }, { status: 500 });
  }
}
