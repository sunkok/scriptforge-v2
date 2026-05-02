import type { NextRequest } from "next/server";
import { getObject, putObject, objectExists } from "@/lib/s3/client";
import { updateShare } from "@/lib/s3/share-index";
import type { ShareRecord } from "@/lib/types";

const TOKEN_RE = /^[A-Za-z0-9_-]{32}$/;

type Ctx = { params: Promise<{ token: string }> };

export async function POST(_req: NextRequest, ctx: Ctx) {
  const { token } = await ctx.params;
  if (!TOKEN_RE.test(token)) {
    return Response.json({ error: "Invalid token" }, { status: 400 });
  }

  try {
    const key = `shares/${token}.json`;
    if (!(await objectExists(key))) {
      return Response.json({ error: "Share not found" }, { status: 404 });
    }

    const revokedAt = new Date().toISOString();

    const raw = await getObject(key);
    const record = JSON.parse(raw) as ShareRecord;
    const updated = { ...record, revokedAt };

    await Promise.all([
      putObject(key, JSON.stringify(updated)),
      updateShare(token, { revokedAt }),
    ]);

    return Response.json(updated);
  } catch (err) {
    console.error("POST /api/shares/[token]/revoke", err);
    return Response.json({ error: "Failed to revoke share" }, { status: 500 });
  }
}
