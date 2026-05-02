import { create } from "zustand";
import type { ElementType } from "@/lib/editor/types";

// Pagination state will be added here when pagination engine is implemented.
// See CLAUDE.md: DO NOT touch pagination logic until explicitly instructed.
interface ScriptForgeState {
  currentElementType: ElementType | null;
  setCurrentElementType: (type: ElementType | null) => void;
}

export const useScriptForgeStore = create<ScriptForgeState>()((set) => ({
  currentElementType: null,
  setCurrentElementType: (type) => set({ currentElementType: type }),
}));
