import { NextRequest } from "next/server";
import { readIndex, upsertScript } from "@/lib/s3/script-index";
import { putObject } from "@/lib/s3/client";
import type { ScriptMetadata } from "@/lib/types";

const UUID_RE = /^[a-f0-9-]{36}$/;

export async function GET(request: NextRequest) {
  try {
    const index = await readIndex();
    const profileId = request.nextUrl.searchParams.get("profileId");
    if (profileId) {
      if (!UUID_RE.test(profileId)) {
        return Response.json({ error: "Invalid profileId" }, { status: 400 });
      }
      const scripts = index.scripts.filter(
        (s) => s.ownerProfileId === profileId
      );
      return Response.json({ scripts });
    }
    return Response.json(index);
  } catch (err) {
    console.error("GET /api/scripts", err);
    return Response.json({ error: "Failed to load scripts" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      title?: unknown;
      fountain?: unknown;
      ownerProfileId?: unknown;
    };

    const title =
      typeof body.title === "string" ? body.title.trim() : "Untitled";
    if (title.length > 200) {
      return Response.json(
        { error: "Title too long (max 200 chars)" },
        { status: 400 }
      );
    }

    const fountain = typeof body.fountain === "string" ? body.fountain : "";
    if (Buffer.byteLength(fountain, "utf8") > 5 * 1024 * 1024) {
      return Response.json(
        { error: "Script too large (max 5 MB)" },
        { status: 400 }
      );
    }

    const ownerProfileId =
      typeof body.ownerProfileId === "string"
        ? body.ownerProfileId.trim()
        : undefined;
    if (ownerProfileId !== undefined && !UUID_RE.test(ownerProfileId)) {
      return Response.json(
        { error: "Invalid ownerProfileId" },
        { status: 400 }
      );
    }

    const scriptId = crypto.randomUUID();
    const now = new Date().toISOString();
    const meta: ScriptMetadata = {
      scriptId,
      title,
      createdAt: now,
      updatedAt: now,
      ...(ownerProfileId !== undefined ? { ownerProfileId } : {}),
    };

    await Promise.all([
      putObject(
        `scripts/${scriptId}/current.fountain`,
        fountain,
        "text/plain"
      ),
      putObject(`scripts/${scriptId}/metadata.json`, JSON.stringify(meta)),
    ]);
    await upsertScript(meta);

    return Response.json(meta, { status: 201 });
  } catch (err) {
    console.error("POST /api/scripts", err);
    return Response.json({ error: "Failed to create script" }, { status: 500 });
  }
}
