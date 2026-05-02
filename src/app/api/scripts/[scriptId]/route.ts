import type { NextRequest } from "next/server";
import {
  getObject,
  putObject,
  deleteObject,
  objectExists,
} from "@/lib/s3/client";
import { upsertScript, removeScript, readIndex } from "@/lib/s3/script-index";
import type { ScriptMetadata, ScriptTitleBlock } from "@/lib/types";

type Ctx = { params: Promise<{ scriptId: string }> };

const UUID_RE = /^[a-f0-9-]{36}$/;

async function getMeta(scriptId: string): Promise<ScriptMetadata> {
  const raw = await getObject(`scripts/${scriptId}/metadata.json`);
  return JSON.parse(raw) as ScriptMetadata;
}

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { scriptId } = await ctx.params;
  if (!UUID_RE.test(scriptId)) {
    return Response.json({ error: "Invalid script ID" }, { status: 400 });
  }

  try {
    const exists = await objectExists(`scripts/${scriptId}/metadata.json`);
    if (!exists)
      return Response.json({ error: "Script not found" }, { status: 404 });

    const [meta, fountain] = await Promise.all([
      getMeta(scriptId),
      getObject(`scripts/${scriptId}/current.fountain`),
    ]);
    return Response.json({ ...meta, fountain });
  } catch (err) {
    console.error("GET /api/scripts/[scriptId]", err);
    return Response.json({ error: "Failed to load script" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, ctx: Ctx) {
  const { scriptId } = await ctx.params;
  if (!UUID_RE.test(scriptId)) {
    return Response.json({ error: "Invalid script ID" }, { status: 400 });
  }

  const isAutosave = request.nextUrl.searchParams.get("autosave") === "true";

  try {
    const exists = await objectExists(`scripts/${scriptId}/metadata.json`);
    if (!exists)
      return Response.json({ error: "Script not found" }, { status: 404 });

    const body = (await request.json()) as {
      title?: unknown;
      fountain?: unknown;
      titleBlock?: unknown;
    };

    const fountain =
      typeof body.fountain === "string" ? body.fountain : null;
    if (fountain !== null && Buffer.byteLength(fountain, "utf8") > 5 * 1024 * 1024) {
      return Response.json(
        { error: "Script too large (max 5 MB)" },
        { status: 400 }
      );
    }

    const current = await getMeta(scriptId);

    let title = current.title;
    if (typeof body.title === "string") {
      title = body.title.trim();
      if (title.length > 200) {
        return Response.json(
          { error: "Title too long (max 200 chars)" },
          { status: 400 }
        );
      }
    }

    let titleBlock: ScriptTitleBlock | undefined;
    if (
      body.titleBlock !== undefined &&
      typeof body.titleBlock === "object" &&
      body.titleBlock !== null
    ) {
      const tb = body.titleBlock as Record<string, unknown>;
      titleBlock = {};
      if (typeof tb.title === "string") titleBlock.title = tb.title.slice(0, 200);
      if (typeof tb.author === "string") titleBlock.author = tb.author.slice(0, 200);
      if (typeof tb.draft === "string") titleBlock.draft = tb.draft.slice(0, 100);
      if (typeof tb.date === "string") titleBlock.date = tb.date.slice(0, 100);
      if (typeof tb.contact === "string") titleBlock.contact = tb.contact.slice(0, 500);
      if (typeof tb.source === "string") titleBlock.source = tb.source.slice(0, 200);
      if (typeof tb.notes === "string") titleBlock.notes = tb.notes.slice(0, 1000);
    }

    const updatedAt = new Date().toISOString();
    const meta: ScriptMetadata = {
      ...current,
      title,
      updatedAt,
      ...(titleBlock !== undefined ? { titleBlock } : {}),
    };

    const writes: Promise<unknown>[] = [
      putObject(`scripts/${scriptId}/metadata.json`, JSON.stringify(meta)),
    ];
    if (fountain !== null) {
      writes.push(
        putObject(
          `scripts/${scriptId}/current.fountain`,
          fountain,
          "text/plain"
        )
      );
    }
    await Promise.all(writes);
    await upsertScript(meta);

    // Autosave snapshot (throttled — may return null).
    let autosaveSnapshot = null;
    if (isAutosave && fountain !== null) {
      const { createHash } = await import("crypto");
      const { recordAutosave } = await import("@/lib/s3/autosave-index");
      const fountainSha256 = createHash("sha256").update(fountain).digest("hex");
      const snapshot = await recordAutosave(scriptId, fountainSha256);
      if (snapshot) {
        await putObject(
          `scripts/${scriptId}/autosaves/${snapshot.date}/${snapshot.slot}.fountain`,
          fountain,
          "text/plain"
        );
        autosaveSnapshot = snapshot;
        console.log(`[autosave] script=${scriptId} SLOT_${snapshot.slot}`);
      } else {
        console.log(`[autosave] script=${scriptId} THROTTLED`);
      }
    }

    return Response.json({ ...meta, ...(isAutosave ? { autosaveSnapshot } : {}) });
  } catch (err) {
    console.error("PUT /api/scripts/[scriptId]", err);
    return Response.json({ error: "Failed to save script" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const { scriptId } = await ctx.params;
  if (!UUID_RE.test(scriptId)) {
    return Response.json({ error: "Invalid script ID" }, { status: 400 });
  }

  try {
    const index = await readIndex();
    if (!index.scripts.find((s) => s.scriptId === scriptId)) {
      return Response.json({ error: "Script not found" }, { status: 404 });
    }

    await Promise.all([
      deleteObject(`scripts/${scriptId}/current.fountain`),
      deleteObject(`scripts/${scriptId}/metadata.json`),
    ]);
    await removeScript(scriptId);

    return new Response(null, { status: 204 });
  } catch (err) {
    console.error("DELETE /api/scripts/[scriptId]", err);
    return Response.json(
      { error: "Failed to delete script" },
      { status: 500 }
    );
  }
}
