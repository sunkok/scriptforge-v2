"use client";

import { useEffect, useState } from "react";
import type { Editor } from "@tiptap/core";

export type SuggestPopupState = {
  kind: "scene_prefix" | "transition";
  top: number;
  left: number;
} | null;

const SCENE_PREFIXES = ["INT. ", "EXT. ", "INT./EXT. ", "I/E. "];
const TRANSITION_PRESETS = [
  "CUT TO:",
  "FADE IN:",
  "FADE OUT.",
  "DISSOLVE TO:",
  "SMASH CUT TO:",
  "MATCH CUT TO:",
];

type Props = {
  editor: Editor;
  state: SuggestPopupState;
  onInsert: (text: string) => void;
  onDismiss: () => void;
};

export default function SuggestPopup({ editor, state, onInsert, onDismiss }: Props) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const items = state?.kind === "scene_prefix" ? SCENE_PREFIXES : TRANSITION_PRESETS;

  // Reset highlighted item whenever the popup kind changes.
  useEffect(() => {
    setSelectedIndex(0);
  }, [state?.kind]);

  // Intercept keyboard events on the editor DOM in capture phase so we
  // handle them before ProseMirror sees them.
  useEffect(() => {
    if (!state) return;
    const domEl = editor.view.dom;

    const handle = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        e.preventDefault();
        onDismiss();
      } else if (e.key === "ArrowDown") {
        e.stopPropagation();
        e.preventDefault();
        setSelectedIndex((i) => (i + 1) % items.length);
      } else if (e.key === "ArrowUp") {
        e.stopPropagation();
        e.preventDefault();
        setSelectedIndex((i) => (i - 1 + items.length) % items.length);
      } else if (e.key === "Enter") {
        e.stopPropagation();
        e.preventDefault();
        onInsert(items[selectedIndex]);
      }
    };

    domEl.addEventListener("keydown", handle, true);
    return () => domEl.removeEventListener("keydown", handle, true);
  }, [state, selectedIndex, items, onInsert, onDismiss, editor.view.dom]);

  if (!state) return null;

  return (
    <div
      className="fixed z-50 rounded shadow-lg py-1 overflow-hidden"
      style={{
        top: state.top + 6,
        left: state.left,
        background: "#4f46e5",
      }}
    >
      {items.map((item, i) => (
        <button
          key={item}
          className="block w-full text-left px-3 py-1 text-xs text-white font-sans transition-colors"
          style={{ background: i === selectedIndex ? "#6366f1" : undefined }}
          onMouseEnter={() => setSelectedIndex(i)}
          onMouseDown={(e) => {
            // Prevent editor blur so the insertion lands at the right position.
            e.preventDefault();
            onInsert(item);
          }}
        >
          {item}
        </button>
      ))}
    </div>
  );
}
