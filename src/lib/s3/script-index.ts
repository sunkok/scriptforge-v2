import { getObject, objectExists, updateIndexWithRetry } from "./client";
import type { ScriptIndex, ScriptMetadata } from "@/lib/types";

const INDEX_KEY = "scripts/index.json";
const EMPTY_INDEX: ScriptIndex = { scripts: [] };

export async function readIndex(): Promise<ScriptIndex> {
  if (!(await objectExists(INDEX_KEY))) {
    return { scripts: [] };
  }
  const raw = await getObject(INDEX_KEY);
  return JSON.parse(raw) as ScriptIndex;
}

export async function upsertScript(meta: ScriptMetadata): Promise<void> {
  await updateIndexWithRetry<ScriptIndex>(INDEX_KEY, EMPTY_INDEX, (index) => {
    const scripts = [...index.scripts];
    const i = scripts.findIndex((s) => s.scriptId === meta.scriptId);
    if (i === -1) scripts.unshift(meta);
    else scripts[i] = meta;
    return { scripts };
  });
}

export async function removeScript(scriptId: string): Promise<void> {
  await updateIndexWithRetry<ScriptIndex>(INDEX_KEY, EMPTY_INDEX, (index) => ({
    scripts: index.scripts.filter((s) => s.scriptId !== scriptId),
  }));
}
