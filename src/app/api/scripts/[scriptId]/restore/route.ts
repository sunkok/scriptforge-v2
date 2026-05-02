import type { NextRequest } from "next/server";
import { getObject, putObject, objectExists } from "@/lib/s3/client";
import { upsertScript } from "@/lib/s3/script-index";
import type { ScriptMetadata } from "@/lib/types";

const UUID_RE = /^[a-f0-9-]{36}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const VALID_SLOTS = new Set([1, 2, 3]);

type Ctx = { params: Promise<{ scriptId: string }> };

export async function POST(request: NextRequest, ctx: Ctx) {
  const { scriptId } = await ctx.params;
  if (!UUID_RE.test(scriptId)) {
    return Response.json({ error: "Invalid script ID" }, { status: 400 });
  }

  try {
    const body = (await request.json()) as {
      source: unknown;
      versionId?: unknown;
      date?: unknown;
      slot?: unknown;
    };

    const metaKey = `scripts/${scriptId}/metadata.json`;
    if (!(await objectExists(metaKey))) {
      return Response.json({ error: "Script not found" }, { status: 404 });
    }

    let fountainKey: string;

    if (body.source === "version") {
      if (typeof body.versionId !== "string" || !UUID_RE.test(body.versionId)) {
        return Response.json({ error: "Invalid versionId" }, { status: 400 });
      }
      fountainKey = `scripts/${scriptId}/versions/${body.versionId}.fountain`;
    } else if (body.source === "autosave") {
      const slot = Number(body.slot);
      if (
        typeof body.date !== "string" ||
        !DATE_RE.test(body.date) ||
        !VALID_SLOTS.has(slot)
      ) {
        return Response.json({ error: "Invalid autosave params" }, { status: 400 });
      }
      fountainKey = `scripts/${scriptId}/autosaves/${body.date}/${slot}.fountain`;
    } else {
      return Response.json({ error: "Invalid source" }, { status: 400 });
    }

    if (!(await objectExists(fountainKey))) {
      return Response.json({ error: "Snapshot not found" }, { status: 404 });
    }

    const [fountain, metaRaw] = await Promise.all([
      getObject(fountainKey),
      getObject(metaKey),
    ]);

    const current = JSON.parse(metaRaw) as ScriptMetadata;
    const meta: ScriptMetadata = { ...current, updatedAt: new Date().toISOString() };

    await Promise.all([
      putObject(`scripts/${scriptId}/current.fountain`, fountain, "text/plain"),
      putObject(metaKey, JSON.stringify(meta)),
    ]);
    await upsertScript(meta);

    return Response.json({ fountain, metadata: meta });
  } catch (err) {
    console.error("POST /api/scripts/[scriptId]/restore", err);
    return Response.json({ error: "Restore failed" }, { status: 500 });
  }
}
