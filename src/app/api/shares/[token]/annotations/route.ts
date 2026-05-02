import type { NextRequest } from "next/server";
import { getObject, objectExists } from "@/lib/s3/client";
import { readAnnotations, addAnnotation } from "@/lib/s3/annotations-store";
import type { ShareRecord, Annotation } from "@/lib/types";

const TOKEN_RE = /^[A-Za-z0-9_-]{32}$/;
const INJECTION_RE = /<script|javascript:|on\w+\s*=/i;

type Ctx = { params: Promise<{ token: string }> };

async function resolveShare(token: string): Promise<ShareRecord | Response> {
  if (!TOKEN_RE.test(token)) {
    return Response.json({ error: "Invalid token" }, { status: 400 });
  }
  const key = `shares/${token}.json`;
  if (!(await objectExists(key))) {
    return Response.json({ error: "Share not found" }, { status: 404 });
  }
  const record = JSON.parse(await getObject(key)) as ShareRecord;
  if (record.revokedAt) {
    return Response.json({ error: "This share link has been revoked" }, { status: 410 });
  }
  if (record.expiresAt && new Date(record.expiresAt) < new Date()) {
    return Response.json({ error: "This share link has expired" }, { status: 410 });
  }
  return record;
}

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { token } = await ctx.params;
  const share = await resolveShare(token);
  if (share instanceof Response) return share;

  try {
    const annotations = await readAnnotations(share.scriptId, share.versionId);
    const sorted = [...annotations].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
    return Response.json({ annotations: sorted });
  } catch (err) {
    console.error("GET /api/shares/[token]/annotations", err);
    return Response.json({ error: "Failed to load annotations" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, ctx: Ctx) {
  const { token } = await ctx.params;
  const share = await resolveShare(token);
  if (share instanceof Response) return share;

  try {
    const body = (await req.json()) as {
      authorName?: unknown;
      body?: unknown;
      anchorStart?: unknown;
      anchorEnd?: unknown;
      anchorQuote?: unknown;
      parentId?: unknown;
    };

    const authorName =
      typeof body.authorName === "string" ? body.authorName.trim() : null;
    if (!authorName || authorName.length < 1 || authorName.length > 100) {
      return Response.json(
        { error: "authorName must be 1–100 characters" },
        { status: 400 }
      );
    }
    if (INJECTION_RE.test(authorName)) {
      return Response.json({ error: "Invalid authorName" }, { status: 400 });
    }

    const bodyText =
      typeof body.body === "string" ? body.body.trim() : null;
    if (!bodyText || bodyText.length < 1 || bodyText.length > 5000) {
      return Response.json(
        { error: "body must be 1–5000 characters" },
        { status: 400 }
      );
    }
    if (INJECTION_RE.test(bodyText)) {
      return Response.json({ error: "Invalid body content" }, { status: 400 });
    }

    const anchorStart = body.anchorStart;
    const anchorEnd = body.anchorEnd;
    if (
      typeof anchorStart !== "number" ||
      !Number.isInteger(anchorStart) ||
      anchorStart < 0 ||
      typeof anchorEnd !== "number" ||
      !Number.isInteger(anchorEnd) ||
      anchorEnd < anchorStart
    ) {
      return Response.json(
        { error: "anchorStart and anchorEnd must be non-negative integers with anchorEnd >= anchorStart" },
        { status: 400 }
      );
    }

    const anchorQuote =
      typeof body.anchorQuote === "string"
        ? body.anchorQuote.slice(0, 200)
        : "";

    const parentId =
      typeof body.parentId === "string" ? body.parentId : null;

    const annotation: Annotation = {
      id: crypto.randomUUID(),
      scriptId: share.scriptId,
      versionId: share.versionId,
      authorName,
      authorRole: "reviewer",
      anchorStart,
      anchorEnd,
      anchorQuote,
      body: bodyText,
      parentId,
      resolvedAt: null,
      createdAt: new Date().toISOString(),
    };

    await addAnnotation(share.scriptId, share.versionId, annotation);
    return Response.json(annotation, { status: 201 });
  } catch (err) {
    console.error("POST /api/shares/[token]/annotations", err);
    return Response.json({ error: "Failed to create annotation" }, { status: 500 });
  }
}
