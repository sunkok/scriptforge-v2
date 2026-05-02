import type { NextRequest } from "next/server";
import { objectExists } from "@/lib/s3/client";
import {
  readAnnotations,
  updateAnnotation,
  deleteAnnotation,
} from "@/lib/s3/annotations-store";

const UUID_RE = /^[a-f0-9-]{36}$/;
const INJECTION_RE = /<script|javascript:|on\w+\s*=/i;

type Ctx = {
  params: Promise<{ scriptId: string; versionId: string; annotationId: string }>;
};

async function resolveVersion(
  scriptId: string,
  versionId: string
): Promise<Response | null> {
  if (!UUID_RE.test(scriptId) || !UUID_RE.test(versionId)) {
    return Response.json({ error: "Invalid ID" }, { status: 400 });
  }
  if (
    !(await objectExists(`scripts/${scriptId}/versions/${versionId}.json`))
  ) {
    return Response.json({ error: "Version not found" }, { status: 404 });
  }
  return null;
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const { scriptId, versionId, annotationId } = await ctx.params;
  const err = await resolveVersion(scriptId, versionId);
  if (err) return err;

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
        return Response.json(
          { error: "resolvedAt must be an ISO string or null" },
          { status: 400 }
        );
      }
      updates.resolvedAt = body.resolvedAt as string | null;
    }

    if (Object.keys(updates).length === 0) {
      return Response.json(
        { error: "No updatable fields provided" },
        { status: 400 }
      );
    }

    const annotations = await readAnnotations(scriptId, versionId);
    if (!annotations.find((a) => a.id === annotationId)) {
      return Response.json({ error: "Annotation not found" }, { status: 404 });
    }

    const updated = await updateAnnotation(
      scriptId,
      versionId,
      annotationId,
      updates
    );
    return Response.json({ annotations: updated });
  } catch (e) {
    console.error(
      "PATCH /api/scripts/[scriptId]/versions/[versionId]/annotations/[annotationId]",
      e
    );
    return Response.json({ error: "Failed to update annotation" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const { scriptId, versionId, annotationId } = await ctx.params;
  const err = await resolveVersion(scriptId, versionId);
  if (err) return err;

  try {
    const annotations = await readAnnotations(scriptId, versionId);
    if (!annotations.find((a) => a.id === annotationId)) {
      return Response.json({ error: "Annotation not found" }, { status: 404 });
    }

    await deleteAnnotation(scriptId, versionId, annotationId);
    return new Response(null, { status: 204 });
  } catch (e) {
    console.error(
      "DELETE /api/scripts/[scriptId]/versions/[versionId]/annotations/[annotationId]",
      e
    );
    return Response.json({ error: "Failed to delete annotation" }, { status: 500 });
  }
}
