import { create } from "zustand";
import type { ElementType } from "@/lib/editor/types";
import type { SaveState, ScriptTitleBlock, VersionMetadata } from "@/lib/types";

export type PaginationStatus = "idle" | "paginating" | "reconciling";

export interface ScriptMeta {
  title: string;
  author: string;
  contact: string;
  draftLabel: string;
}

interface ScriptForgeState {
  // Editor element tracking
  currentElementType: ElementType | null;
  setCurrentElementType: (type: ElementType | null) => void;
  // Page / word counts
  pageCount: number;
  setPageCount: (n: number) => void;
  wordCount: number;
  setWordCount: (n: number) => void;
  // Pagination engine status
  paginationStatus: PaginationStatus;
  setPaginationStatus: (status: PaginationStatus) => void;
  // Script title-page metadata (used by print/export)
  scriptMeta: ScriptMeta;
  setScriptMeta: (meta: Partial<ScriptMeta>) => void;
  // Active script identity and persistence state
  currentScriptId: string | null;
  setCurrentScriptId: (id: string | null) => void;
  scriptTitle: string;
  setScriptTitle: (title: string) => void;
  titleBlock: ScriptTitleBlock | undefined;
  setTitleBlock: (block: ScriptTitleBlock | undefined) => void;
  saveState: SaveState;
  setSaveState: (state: SaveState) => void;
  // Versions for the active script
  versions: VersionMetadata[];
  setVersions: (versions: VersionMetadata[]) => void;
  // Versions modal visibility
  isVersionsModalOpen: boolean;
  setIsVersionsModalOpen: (open: boolean) => void;
}

export const useScriptForgeStore = create<ScriptForgeState>()((set) => ({
  currentElementType: null,
  setCurrentElementType: (type) => set({ currentElementType: type }),
  pageCount: 1,
  setPageCount: (n) => set({ pageCount: n }),
  wordCount: 0,
  setWordCount: (n) => set({ wordCount: n }),
  paginationStatus: "idle",
  setPaginationStatus: (status) => set({ paginationStatus: status }),
  scriptMeta: { title: "", author: "", contact: "", draftLabel: "" },
  setScriptMeta: (meta) =>
    set((s) => ({ scriptMeta: { ...s.scriptMeta, ...meta } })),
  currentScriptId: null,
  setCurrentScriptId: (id) => set({ currentScriptId: id }),
  scriptTitle: "Untitled",
  setScriptTitle: (title) => set({ scriptTitle: title }),
  titleBlock: undefined,
  setTitleBlock: (block) => set({ titleBlock: block }),
  saveState: "saved",
  setSaveState: (state) => set({ saveState: state }),
  versions: [],
  setVersions: (versions) => set({ versions }),
  isVersionsModalOpen: false,
  setIsVersionsModalOpen: (open) => set({ isVersionsModalOpen: open }),
}));
