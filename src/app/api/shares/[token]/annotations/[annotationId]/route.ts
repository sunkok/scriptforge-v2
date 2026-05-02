import type { NextRequest } from "next/server";
import { getObject, objectExists } from "@/lib/s3/client";
import {
  readAnnotations,
  updateAnnotation,
  deleteAnnotation,
} from "@/lib/s3/annotations-store";
import type { ShareRecord } from "@/lib/types";

const TOKEN_RE = /^[A-Za-z0-9_-]{32}$/;
const INJECTION_RE = /<script|javascript:|on\w+\s*=/i;

type Ctx = { params: Promise<{ token: string; annotationId: string }> };

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

// PATCH: update body and/or resolvedAt for an annotation.
// Note: any holder of the share token can edit any annotation. Fine for
// Sun + Adrian single-reviewer use case; multi-reviewer would need per-author
// auth (e.g. a name stored in localStorage matched against annotation.authorName).
export async function PATCH(req: NextRequest, ctx: Ctx) {
  const { token, annotationId } = await ctx.params;
  const share = await resolveShare(token);
  if (share instanceof Response) return share;

  try {
    const body = (await req.json()) as {
      body?: unknown;
      resolvedAt?: unknown;
    };

    const updates: Record<string, string | null> = {};

    if (body.body !== undefined) {
      const newBody =
        typeof body.body === "string" ? body.body.trim() : null;
      if (!newBody || newBody.length < 1 || newBody.length > 5000) {
        return Response.json(
          { error: "body must be 1–5000 characters" },
          { status: 400 }
        );
      }
      if (INJECTION_RE.test(newBody)) {
        return Response.json({ error: "Invalid body content" }, { status: 400 });
      }
      updates.body = newBody;
    }

    if (body.resolvedAt !== undefined) {
      if (body.resolvedAt !== null && typeof body.resolvedAt !== "string") {
        return Response.json({ error: "resolvedAt must be an ISO string or null" }, { status: 400 });
      }
      updates.resolvedAt = body.resolvedAt as string | null;
    }

    if (Object.keys(updates).length === 0) {
      return Response.json({ error: "No updatable fields provided" }, { status: 400 });
    }

    const annotations = await readAnnotations(share.scriptId, share.versionId);
    if (!annotations.find((a) => a.id === annotationId)) {
      return Response.json({ error: "Annotation not found" }, { status: 404 });
    }

    const updated = await updateAnnotation(
      share.scriptId,
      share.versionId,
      annotationId,
      updates
    );
    return Response.json({ annotations: updated });
  } catch (err) {
    console.error("PATCH /api/shares/[token]/annotations/[annotationId]", err);
    return Response.json({ error: "Failed to update annotation" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const { token, annotationId } = await ctx.params;
  const share = await resolveShare(token);
  if (share instanceof Response) return share;

  try {
    const annotations = await readAnnotations(share.scriptId, share.versionId);
    if (!annotations.find((a) => a.id === annotationId)) {
      return Response.json({ error: "Annotation not found" }, { status: 404 });
    }

    await deleteAnnotation(share.scriptId, share.versionId, annotationId);
    return new Response(null, { status: 204 });
  } catch (err) {
    console.error("DELETE /api/shares/[token]/annotations/[annotationId]", err);
    return Response.json({ error: "Failed to delete annotation" }, { status: 500 });
  }
}
