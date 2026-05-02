import { getObject, objectExists, deleteObject, getObjectWithEtag, putObject } from "@/lib/s3/client";
import type { AutosaveSnapshot, AutosavesIndex } from "@/lib/types";

const AUTOSAVE_SNAPSHOT_INTERVAL_MS = 15 * 60 * 1000;
const MAX_RETRIES = 3;

function indexKey(scriptId: string): string {
  return `scripts/${scriptId}/autosaves-index.json`;
}

export function todayUTC(): string {
  return new Date().toISOString().split("T")[0];
}

export async function readAutosavesIndex(scriptId: string): Promise<AutosavesIndex> {
  if (!(await objectExists(indexKey(scriptId)))) {
    return { scriptId, snapshots: [] };
  }
  const raw = await getObject(indexKey(scriptId));
  return JSON.parse(raw) as AutosavesIndex;
}

export async function deleteAutosavesIndex(scriptId: string): Promise<void> {
  await deleteObject(indexKey(scriptId));
}

// recordAutosave throttles snapshot creation to AUTOSAVE_SNAPSHOT_INTERVAL_MS.
// Uses ETag-based optimistic locking to handle concurrent saves.
export async function recordAutosave(
  scriptId: string,
  fountainSha256: string
): Promise<AutosaveSnapshot | null> {
  const key = indexKey(scriptId);
  const empty: AutosavesIndex = { scriptId, snapshots: [] };

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    let index: AutosavesIndex = empty;
    let etag: string | undefined;

    try {
      const result = await getObjectWithEtag(key);
      index = JSON.parse(result.body) as AutosavesIndex;
      etag = result.etag;
    } catch (err: unknown) {
      const isNotFound =
        err instanceof Error &&
        (err.name === "NotFound" ||
          err.name === "NoSuchKey" ||
          (err as { $metadata?: { httpStatusCode?: number } }).$metadata
            ?.httpStatusCode === 404);
      if (!isNotFound) throw err;
    }

    // OUTER THROTTLE GATE — check across ALL dates before doing anything.
    if (index.snapshots.length > 0) {
      const mostRecent = index.snapshots.reduce((a, b) =>
        new Date(a.createdAt) > new Date(b.createdAt) ? a : b
      );
      const elapsed = Date.now() - new Date(mostRecent.createdAt).getTime();
      if (elapsed < AUTOSAVE_SNAPSHOT_INTERVAL_MS) {
        return null;
      }
    }

    // Past the throttle gate — assign a slot for today.
    const today = todayUTC();
    const todaySnapshots = index.snapshots.filter((s) => s.date === today);

    let slot: 1 | 2 | 3;
    let updatedSnapshots = [...index.snapshots];
    if (todaySnapshots.length < 3) {
      slot = (todaySnapshots.length + 1) as 1 | 2 | 3;
    } else {
      // All 3 slots occupied — overwrite the oldest.
      const oldest = todaySnapshots.reduce((a, b) =>
        new Date(a.createdAt) < new Date(b.createdAt) ? a : b
      );
      slot = oldest.slot;
      updatedSnapshots = updatedSnapshots.filter(
        (s) => !(s.date === today && s.slot === slot)
      );
    }

    const snapshot: AutosaveSnapshot = {
      date: today,
      slot,
      createdAt: new Date().toISOString(),
      fountainSha256,
    };
    updatedSnapshots.push(snapshot);

    try {
      await putObject(
        key,
        JSON.stringify({ scriptId, snapshots: updatedSnapshots }),
        "application/json",
        etag
      );
      return snapshot;
    } catch (err: unknown) {
      const is412 =
        err instanceof Error &&
        (err.name === "PreconditionFailed" ||
          (err as { $metadata?: { httpStatusCode?: number } }).$metadata
            ?.httpStatusCode === 412);
      if (is412 && attempt < MAX_RETRIES - 1) continue;
      throw err;
    }
  }
  throw new Error(`Persistent write conflict on autosave index for ${scriptId}`);
}
