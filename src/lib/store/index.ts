import { create } from "zustand";

// Pagination state will be added here when pagination engine is implemented.
// See CLAUDE.md: DO NOT touch pagination logic until explicitly instructed.
interface ScriptForgeState {
  _placeholder: null;
}

export const useScriptForgeStore = create<ScriptForgeState>()(() => ({
  _placeholder: null,
}));
