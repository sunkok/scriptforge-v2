import type { NextRequest } from "next/server";
import { getObject, putObject, objectExists } from "@/lib/s3/client";
import { appendShare, readSharesIndex } from "@/lib/s3/share-index";
import { readVersionsIndex } from "@/lib/s3/version-index";
import { generateShareToken } from "@/lib/s3/share-token";
import type { ShareRecord, ScriptMetadata } from "@/lib/types";

const UUID_RE = /^[a-f0-9-]{36}$/;

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      scriptId?: unknown;
      versionId?: unknown;
      expiresInDays?: unknown;
    };

    const scriptId = typeof body.scriptId === "string" ? body.scriptId : null;
    const versionId = typeof body.versionId === "string" ? body.versionId : null;

    if (!scriptId || !UUID_RE.test(scriptId) || !versionId || !UUID_RE.test(versionId)) {
      return Response.json({ error: "Invalid scriptId or versionId" }, { status: 400 });
    }

    let expiresInDays: number | null = null;
    if (body.expiresInDays != null) {
      if (
        typeof body.expiresInDays !== "number" ||
        body.expiresInDays <= 0 ||
        !Number.isInteger(body.expiresInDays)
      ) {
        return Response.json(
          { error: "expiresInDays must be a positive integer" },
          { status: 400 }
        );
      }
      expiresInDays = body.expiresInDays;
    }

    const metaKey = `scripts/${scriptId}/metadata.json`;
    if (!(await objectExists(metaKey))) {
      return Response.json({ error: "Script not found" }, { status: 404 });
    }

    const [metaRaw, versionsIndex] = await Promise.all([
      getObject(metaKey),
      readVersionsIndex(scriptId),
    ]);
    const meta = JSON.parse(metaRaw) as ScriptMetadata;

    const version = versionsIndex.versions.find((v) => v.versionId === versionId);
    if (!version) {
      return Response.json({ error: "Version not found" }, { status: 404 });
    }

    const token = generateShareToken();
    const now = new Date();
    const expiresAt = expiresInDays
      ? new Date(now.getTime() + expiresInDays * 86_400_000).toISOString()
      : null;

    const record: ShareRecord = {
      token,
      scriptId,
      versionId,
      scriptTitle: meta.title,
      versionLabel: version.label,
      createdAt: now.toISOString(),
      expiresAt,
      revokedAt: null,
    };

    await putObject(`shares/${token}.json`, JSON.stringify(record));
    await appendShare(record);

    return Response.json(record, { status: 201 });
  } catch (err) {
    console.error("POST /api/shares", err);
    return Response.json({ error: "Failed to create share" }, { status: 500 });
  }
}

export async function GET(_req: NextRequest) {
  try {
    const index = await readSharesIndex();
    const sorted = [...index.shares].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    return Response.json({ shares: sorted });
  } catch (err) {
    console.error("GET /api/shares", err);
    return Response.json({ error: "Failed to load shares" }, { status: 500 });
  }
}
