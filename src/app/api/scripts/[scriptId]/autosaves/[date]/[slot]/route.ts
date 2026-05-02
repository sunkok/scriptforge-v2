import type { NextRequest } from "next/server";
import { getObject, objectExists } from "@/lib/s3/client";
import { readAutosavesIndex } from "@/lib/s3/autosave-index";
import type { AutosaveSnapshot } from "@/lib/types";

const UUID_RE = /^[a-f0-9-]{36}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const VALID_SLOTS = new Set(["1", "2", "3"]);

type Ctx = { params: Promise<{ scriptId: string; date: string; slot: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { scriptId, date, slot } = await ctx.params;
  if (!UUID_RE.test(scriptId) || !DATE_RE.test(date) || !VALID_SLOTS.has(slot)) {
    return Response.json({ error: "Invalid parameters" }, { status: 400 });
  }

  try {
    const fountainKey = `scripts/${scriptId}/autosaves/${date}/${slot}.fountain`;
    if (!(await objectExists(fountainKey))) {
      return Response.json({ error: "Auto-save not found" }, { status: 404 });
    }

    const [fountain, index] = await Promise.all([
      getObject(fountainKey),
      readAutosavesIndex(scriptId),
    ]);

    const slotNum = Number(slot) as 1 | 2 | 3;
    const snapshot = index.snapshots.find(
      (s) => s.date === date && s.slot === slotNum
    ) as AutosaveSnapshot | undefined;

    if (!snapshot) {
      return Response.json({ error: "Auto-save not found" }, { status: 404 });
    }

    return Response.json({ fountain, snapshot });
  } catch (err) {
    console.error("GET /api/scripts/[scriptId]/autosaves/[date]/[slot]", err);
    return Response.json({ error: "Failed to load auto-save" }, { status: 500 });
  }
}
