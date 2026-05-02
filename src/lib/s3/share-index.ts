import { getObject, objectExists, updateIndexWithRetry } from "@/lib/s3/client";
import type { ShareRecord, SharesIndex } from "@/lib/types";

const INDEX_KEY = "shares-index.json";
const EMPTY_INDEX: SharesIndex = { shares: [] };

export async function readSharesIndex(): Promise<SharesIndex> {
  if (!(await objectExists(INDEX_KEY))) {
    return { shares: [] };
  }
  const raw = await getObject(INDEX_KEY);
  return JSON.parse(raw) as SharesIndex;
}

export async function appendShare(record: ShareRecord): Promise<void> {
  await updateIndexWithRetry<SharesIndex>(INDEX_KEY, EMPTY_INDEX, (index) => ({
    shares: [record, ...index.shares],
  }));
}

export async function updateShare(
  token: string,
  updates: Partial<ShareRecord>
): Promise<ShareRecord | null> {
  let found: ShareRecord | null = null;
  await updateIndexWithRetry<SharesIndex>(INDEX_KEY, EMPTY_INDEX, (index) => {
    const i = index.shares.findIndex((s) => s.token === token);
    if (i === -1) return index;
    const updated = { ...index.shares[i], ...updates };
    found = updated;
    const shares = [...index.shares];
    shares[i] = updated;
    return { shares };
  });
  return found;
}
