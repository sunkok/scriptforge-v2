export type ScriptTitleBlock = {
  title?: string;
  author?: string;
  draft?: string;
  date?: string;
  contact?: string;
  source?: string;
  notes?: string;
};

export interface ScriptMetadata {
  scriptId: string;
  title: string;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
  titleBlock?: ScriptTitleBlock;
}

export interface ScriptIndex {
  scripts: ScriptMetadata[];
}

export type SaveState =
  | "saved"
  | "saving"
  | "unsaved"
  | "error"
  | "loading"
  | "readonly";

export interface VersionMetadata {
  versionId: string;
  scriptId: string;
  label: string;
  createdAt: string;
  fountainSha256: string;
  pageCount?: number;
  wordCount?: number;
}

export interface VersionsIndex {
  scriptId: string;
  versions: VersionMetadata[];
}

export type AutosaveSnapshot = {
  date: string;       // "YYYY-MM-DD" UTC
  slot: 1 | 2 | 3;
  createdAt: string;  // ISO datetime
  fountainSha256: string;
};

export type AutosavesIndex = {
  scriptId: string;
  snapshots: AutosaveSnapshot[];
};
