// Versions are immutable snapshots — no PUT or DELETE routes exist by design.
// A version, once created, can never be modified or removed.
import type { NextRequest } from "next/server";
import { getObject, objectExists } from "@/lib/s3/client";
import type { VersionMetadata } from "@/lib/types";

const UUID_RE = /^[a-f0-9-]{36}$/;

type Ctx = { params: Promise<{ scriptId: string; versionId: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { scriptId, versionId } = await ctx.params;
  if (!UUID_RE.test(scriptId) || !UUID_RE.test(versionId)) {
    return Response.json({ error: "Invalid ID" }, { status: 400 });
  }

  try {
    const metaKey = `scripts/${scriptId}/versions/${versionId}.json`;
    if (!(await objectExists(metaKey))) {
      return Response.json({ error: "Version not found" }, { status: 404 });
    }

    const [fountain, metaRaw] = await Promise.all([
      getObject(`scripts/${scriptId}/versions/${versionId}.fountain`),
      getObject(metaKey),
    ]);
    const metadata = JSON.parse(metaRaw) as VersionMetadata;

    return Response.json({ fountain, metadata });
  } catch (err) {
    console.error("GET /api/scripts/[scriptId]/versions/[versionId]", err);
    return Response.json({ error: "Failed to load version" }, { status: 500 });
  }
}
