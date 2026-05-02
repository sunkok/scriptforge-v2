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
  "JUMP CUT TO:",
  "TIME CUT:",
  "INTERCUT WITH:",
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
      } else if (e.key >= "1" && e.key <= "9") {
        const idx = parseInt(e.key, 10) - 1;
        if (idx < items.length) {
          e.stopPropagation();
          e.preventDefault();
          onInsert(items[idx]);
        }
      }
    };

    domEl.addEventListener("keydown", handle, true);
    return () => domEl.removeEventListener("keydown", handle, true);
  }, [state, selectedIndex, items, onInsert, onDismiss, editor.view.dom]);

  if (!state) return null;

  return (
    <div
      className="fixed z-50 rounded-md overflow-hidden py-1"
      style={{
        top: state.top + 6,
        left: state.left,
        background: "#1a1a1f",
        border: "1px solid #2a2a35",
        boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
        minWidth: "180px",
      }}
    >
      {items.map((item, i) => (
        <button
          key={item}
          className="flex items-center w-full text-left text-[13px] font-sans gap-2.5 transition-colors"
          style={{
            padding: "5px 12px 5px 9px",
            background: i === selectedIndex ? "#2a2a30" : "transparent",
            borderLeft: i === selectedIndex ? "3px solid #6366f1" : "3px solid transparent",
          }}
          onMouseEnter={() => setSelectedIndex(i)}
          onMouseDown={(e) => {
            // Prevent editor blur so the insertion lands at the right position.
            e.preventDefault();
            onInsert(item);
          }}
        >
          <span
            className="font-mono text-[12px] shrink-0"
            style={{ color: "#6b6b76", minWidth: "12px" }}
          >
            {i + 1}
          </span>
          <span style={{ color: "white" }}>{item.trim()}</span>
        </button>
      ))}
    </div>
  );
}
