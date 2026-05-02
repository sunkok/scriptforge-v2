import type { NextRequest } from "next/server";
import { readProfilesIndex, upsertProfile } from "@/lib/s3/profile-index";
import { assignOwnerToUnowned } from "@/lib/s3/script-index";
import type { Profile } from "@/lib/types";

export async function GET() {
  try {
    const index = await readProfilesIndex();
    const sorted = [...index.profiles].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
    return Response.json({ profiles: sorted });
  } catch (e) {
    console.error("GET /api/profiles", e);
    return Response.json({ error: "Failed to load profiles" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
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
    const isFirst = index.profiles.length === 0;

    const profile: Profile = {
      profileId: crypto.randomUUID(),
      name,
      createdAt: new Date().toISOString(),
    };

    await upsertProfile(profile);

    if (isFirst) {
      const count = await assignOwnerToUnowned(profile.profileId);
      console.log(
        `[migration] assigned ${count} script${count === 1 ? "" : "s"} to first profile ${name}`
      );
    }

    return Response.json(profile, { status: 201 });
  } catch (e) {
    console.error("POST /api/profiles", e);
    return Response.json({ error: "Failed to create profile" }, { status: 500 });
  }
}
