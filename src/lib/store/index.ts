import { create } from "zustand";
import type { ElementType } from "@/lib/editor/types";

export type PaginationStatus = "idle" | "paginating" | "reconciling";

interface ScriptForgeState {
  currentElementType: ElementType | null;
  setCurrentElementType: (type: ElementType | null) => void;
  pageCount: number;
  setPageCount: (n: number) => void;
  paginationStatus: PaginationStatus;
  setPaginationStatus: (status: PaginationStatus) => void;
}

export const useScriptForgeStore = create<ScriptForgeState>()((set) => ({
  currentElementType: null,
  setCurrentElementType: (type) => set({ currentElementType: type }),
  pageCount: 1,
  setPageCount: (n) => set({ pageCount: n }),
  paginationStatus: "idle",
  setPaginationStatus: (status) => set({ paginationStatus: status }),
}));
