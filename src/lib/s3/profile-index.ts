import { getObject, objectExists, updateIndexWithRetry } from "./client";
import type { Profile, ProfilesIndex } from "@/lib/types";

const INDEX_KEY = "profiles/index.json";
const EMPTY_INDEX: ProfilesIndex = { profiles: [] };

export async function readProfilesIndex(): Promise<ProfilesIndex> {
  if (!(await objectExists(INDEX_KEY))) {
    return { profiles: [] };
  }
  const raw = await getObject(INDEX_KEY);
  return JSON.parse(raw) as ProfilesIndex;
}

export async function upsertProfile(profile: Profile): Promise<void> {
  await updateIndexWithRetry<ProfilesIndex>(INDEX_KEY, EMPTY_INDEX, (index) => {
    const profiles = [...index.profiles];
    const i = profiles.findIndex((p) => p.profileId === profile.profileId);
    if (i === -1) profiles.push(profile);
    else profiles[i] = profile;
    return { profiles };
  });
}

export async function removeProfile(profileId: string): Promise<void> {
  await updateIndexWithRetry<ProfilesIndex>(INDEX_KEY, EMPTY_INDEX, (index) => ({
    profiles: index.profiles.filter((p) => p.profileId !== profileId),
  }));
}
