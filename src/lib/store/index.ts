import { create } from "zustand";
import type { ElementType } from "@/lib/editor/types";

export type PaginationStatus = "idle" | "paginating" | "reconciling";

export interface ScriptMeta {
  title: string;
  author: string;
  contact: string;
  draftLabel: string;
}

interface ScriptForgeState {
  currentElementType: ElementType | null;
  setCurrentElementType: (type: ElementType | null) => void;
  pageCount: number;
  setPageCount: (n: number) => void;
  wordCount: number;
  setWordCount: (n: number) => void;
  paginationStatus: PaginationStatus;
  setPaginationStatus: (status: PaginationStatus) => void;
  scriptMeta: ScriptMeta;
  setScriptMeta: (meta: Partial<ScriptMeta>) => void;
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
}));
