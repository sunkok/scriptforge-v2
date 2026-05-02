import type { NextRequest } from "next/server";
import { objectExists } from "@/lib/s3/client";
import { readAnnotations, addAnnotation } from "@/lib/s3/annotations-store";
import type { Annotation } from "@/lib/types";

const UUID_RE = /^[a-f0-9-]{36}$/;
const INJECTION_RE = /<script|javascript:|on\w+\s*=/i;

type Ctx = { params: Promise<{ scriptId: string; versionId: string }> };

async function resolveVersion(
  scriptId: string,
  versionId: string
): Promise<Response | null> {
  if (!UUID_RE.test(scriptId) || !UUID_RE.test(versionId)) {
    return Response.json({ error: "Invalid ID" }, { status: 400 });
  }
  const metaKey = `scripts/${scriptId}/versions/${versionId}.json`;
  if (!(await objectExists(metaKey))) {
    return Response.json({ error: "Version not found" }, { status: 404 });
  }
  return null;
}

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { scriptId, versionId } = await ctx.params;
  const err = await resolveVersion(scriptId, versionId);
  if (err) return err;

  try {
    const annotations = await readAnnotations(scriptId, versionId);
    const sorted = [...annotations].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
    return Response.json({ annotations: sorted });
  } catch (e) {
    console.error("GET /api/scripts/[scriptId]/versions/[versionId]/annotations", e);
    return Response.json({ error: "Failed to load annotations" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, ctx: Ctx) {
  const { scriptId, versionId } = await ctx.params;
  const err = await resolveVersion(scriptId, versionId);
  if (err) return err;

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
        {
          error:
            "anchorStart and anchorEnd must be non-negative integers with anchorEnd >= anchorStart",
        },
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
      scriptId,
      versionId,
      authorName,
      authorRole: "writer",
      anchorStart,
      anchorEnd,
      anchorQuote,
      body: bodyText,
      parentId,
      resolvedAt: null,
      createdAt: new Date().toISOString(),
    };

    await addAnnotation(scriptId, versionId, annotation);
    return Response.json(annotation, { status: 201 });
  } catch (e) {
    console.error("POST /api/scripts/[scriptId]/versions/[versionId]/annotations", e);
    return Response.json({ error: "Failed to create annotation" }, { status: 500 });
  }
}
