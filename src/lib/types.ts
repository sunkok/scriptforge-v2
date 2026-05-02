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
