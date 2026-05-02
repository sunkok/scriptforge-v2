import { createHash } from "crypto";
import type { NextRequest } from "next/server";
import { getObject, putObject, objectExists } from "@/lib/s3/client";
import { readVersionsIndex, appendVersion } from "@/lib/s3/version-index";
import type { VersionMetadata } from "@/lib/types";

const UUID_RE = /^[a-f0-9-]{36}$/;

type Ctx = { params: Promise<{ scriptId: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { scriptId } = await ctx.params;
  if (!UUID_RE.test(scriptId)) {
    return Response.json({ error: "Invalid script ID" }, { status: 400 });
  }

  try {
    const index = await readVersionsIndex(scriptId);
    const sorted = [...index.versions].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    return Response.json({ versions: sorted });
  } catch (err) {
    console.error("GET /api/scripts/[scriptId]/versions", err);
    return Response.json({ error: "Failed to load versions" }, { status: 500 });
  }
}

export async function POST(request: NextRequest, ctx: Ctx) {
  const { scriptId } = await ctx.params;
  if (!UUID_RE.test(scriptId)) {
    return Response.json({ error: "Invalid script ID" }, { status: 400 });
  }

  try {
    const fountainKey = `scripts/${scriptId}/current.fountain`;
    if (!(await objectExists(fountainKey))) {
      return Response.json({ error: "Script not found" }, { status: 404 });
    }

    const body = (await request.json()) as { label?: unknown };
    const index = await readVersionsIndex(scriptId);
    const defaultLabel = `Draft ${index.versions.length + 1}`;
    const label =
      typeof body.label === "string" && body.label.trim()
        ? body.label.trim().slice(0, 200)
        : defaultLabel;

    const fountain = await getObject(fountainKey);
    const fountainSha256 = createHash("sha256").update(fountain).digest("hex");

    const lines = fountain.split("\n");
    const pageCount = Math.max(1, Math.ceil(lines.length / 55));
    const wordCount = fountain.split(/\s+/).filter((w) => w.length > 0).length;

    const versionId = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    const metadata: VersionMetadata = {
      versionId,
      scriptId,
      label,
      createdAt,
      fountainSha256,
      pageCount,
      wordCount,
    };

    await Promise.all([
      putObject(
        `scripts/${scriptId}/versions/${versionId}.fountain`,
        fountain,
        "text/plain"
      ),
      putObject(
        `scripts/${scriptId}/versions/${versionId}.json`,
        JSON.stringify(metadata)
      ),
    ]);
    await appendVersion(scriptId, metadata);

    return Response.json(metadata, { status: 201 });
  } catch (err) {
    console.error("POST /api/scripts/[scriptId]/versions", err);
    return Response.json({ error: "Failed to create version" }, { status: 500 });
  }
}
