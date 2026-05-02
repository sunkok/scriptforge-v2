import type { NextRequest } from "next/server";
import { getObject, objectExists } from "@/lib/s3/client";
import type { ShareRecord } from "@/lib/types";

const TOKEN_RE = /^[A-Za-z0-9_-]{32}$/;

type Ctx = { params: Promise<{ token: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { token } = await ctx.params;
  if (!TOKEN_RE.test(token)) {
    return Response.json({ error: "Invalid token" }, { status: 400 });
  }

  try {
    const key = `shares/${token}.json`;
    if (!(await objectExists(key))) {
      return Response.json({ error: "Share not found" }, { status: 404 });
    }

    const raw = await getObject(key);
    const record = JSON.parse(raw) as ShareRecord;

    if (record.revokedAt) {
      return Response.json({ error: "This share link has been revoked" }, { status: 410 });
    }

    if (record.expiresAt && new Date(record.expiresAt) < new Date()) {
      return Response.json({ error: "This share link has expired" }, { status: 410 });
    }

    const fountain = await getObject(
      `scripts/${record.scriptId}/versions/${record.versionId}.fountain`
    );

    return Response.json({
      fountain,
      scriptTitle: record.scriptTitle,
      versionLabel: record.versionLabel,
      versionId: record.versionId,
      scriptId: record.scriptId,
      createdAt: record.createdAt,
    });
  } catch (err) {
    console.error("GET /api/shares/[token]", err);
    return Response.json({ error: "Failed to load shared script" }, { status: 500 });
  }
}
