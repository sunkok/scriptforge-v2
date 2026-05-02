import { getObject, putObject, objectExists } from "@/lib/s3/client";
import type { Annotation } from "@/lib/types";

function annotationsKey(scriptId: string, versionId: string) {
  return `scripts/${scriptId}/versions/${versionId}/annotations.json`;
}

export async function readAnnotations(
  scriptId: string,
  versionId: string
): Promise<Annotation[]> {
  const key = annotationsKey(scriptId, versionId);
  if (!(await objectExists(key))) return [];
  const raw = await getObject(key);
  return JSON.parse(raw) as Annotation[];
}

export async function writeAnnotations(
  scriptId: string,
  versionId: string,
  annotations: Annotation[]
): Promise<void> {
  await putObject(
    annotationsKey(scriptId, versionId),
    JSON.stringify(annotations)
  );
}

export async function addAnnotation(
  scriptId: string,
  versionId: string,
  annotation: Annotation
): Promise<Annotation[]> {
  const annotations = await readAnnotations(scriptId, versionId);
  const updated = [...annotations, annotation];
  await writeAnnotations(scriptId, versionId, updated);
  return updated;
}

export async function updateAnnotation(
  scriptId: string,
  versionId: string,
  id: string,
  updates: Partial<Annotation>
): Promise<Annotation[]> {
  const annotations = await readAnnotations(scriptId, versionId);
  const updated = annotations.map((a) => (a.id === id ? { ...a, ...updates } : a));
  await writeAnnotations(scriptId, versionId, updated);
  return updated;
}

export async function deleteAnnotation(
  scriptId: string,
  versionId: string,
  id: string
): Promise<Annotation[]> {
  const annotations = await readAnnotations(scriptId, versionId);
  // Cascade: remove the annotation and all replies to it
  const updated = annotations.filter((a) => a.id !== id && a.parentId !== id);
  await writeAnnotations(scriptId, versionId, updated);
  return updated;
}
