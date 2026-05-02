import type { NextRequest } from "next/server";
import { readProfilesIndex, upsertProfile, removeProfile } from "@/lib/s3/profile-index";
import { readIndex } from "@/lib/s3/script-index";
import type { Profile } from "@/lib/types";

const UUID_RE = /^[a-f0-9-]{36}$/;

type Ctx = { params: Promise<{ profileId: string }> };

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const { profileId } = await ctx.params;
  if (!UUID_RE.test(profileId)) {
    return Response.json({ error: "Invalid profile ID" }, { status: 400 });
  }

  try {
    const body = (await req.json()) as { name?: unknown };
    const name = typeof body.name === "string" ? body.name.trim() : null;
    if (!name || name.length < 1 || name.length > 50) {
      return Response.json(
        { error: "name must be 1–50 characters" },
        { status: 400 }
      );
    }

    const index = await readProfilesIndex();
    const existing = index.profiles.find((p) => p.profileId === profileId);
    if (!existing) {
      return Response.json({ error: "Profile not found" }, { status: 404 });
    }

    const updated: Profile = { ...existing, name };
    await upsertProfile(updated);
    return Response.json(updated);
  } catch (e) {
    console.error("PATCH /api/profiles/[profileId]", e);
    return Response.json({ error: "Failed to update profile" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const { profileId } = await ctx.params;
  if (!UUID_RE.test(profileId)) {
    return Response.json({ error: "Invalid profile ID" }, { status: 400 });
  }

  try {
    const index = await readProfilesIndex();
    if (!index.profiles.find((p) => p.profileId === profileId)) {
      return Response.json({ error: "Profile not found" }, { status: 404 });
    }

    const scriptsIndex = await readIndex();
    const owned = scriptsIndex.scripts.filter(
      (s) => s.ownerProfileId === profileId
    );
    if (owned.length > 0) {
      return Response.json(
        {
          error: `Cannot delete profile with ${owned.length} owned script${owned.length === 1 ? "" : "s"}. Reassign or delete those scripts first.`,
        },
        { status: 409 }
      );
    }

    await removeProfile(profileId);
    return new Response(null, { status: 204 });
  } catch (e) {
    console.error("DELETE /api/profiles/[profileId]", e);
    return Response.json({ error: "Failed to delete profile" }, { status: 500 });
  }
}
