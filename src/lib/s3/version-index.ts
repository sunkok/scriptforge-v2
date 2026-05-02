import { getObject, objectExists, updateIndexWithRetry } from "@/lib/s3/client";
import type { VersionMetadata, VersionsIndex } from "@/lib/types";

function indexKey(scriptId: string) {
  return `scripts/${scriptId}/versions-index.json`;
}

export async function readVersionsIndex(scriptId: string): Promise<VersionsIndex> {
  if (!(await objectExists(indexKey(scriptId)))) {
    return { scriptId, versions: [] };
  }
  const raw = await getObject(indexKey(scriptId));
  return JSON.parse(raw) as VersionsIndex;
}

// Versions are append-only and never removed or modified.
export async function appendVersion(
  scriptId: string,
  metadata: VersionMetadata
): Promise<void> {
  const empty: VersionsIndex = { scriptId, versions: [] };
  await updateIndexWithRetry<VersionsIndex>(indexKey(scriptId), empty, (index) => ({
    scriptId,
    versions: [...index.versions, metadata],
  }));
}
