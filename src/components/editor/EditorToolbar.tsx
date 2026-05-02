"use client";

import { Upload, Download, Wand2 } from "lucide-react";
import type { Editor } from "@tiptap/core";
import { useScriptForgeStore } from "@/lib/store";
import { ELEMENT_DISPLAY_NAMES, type ElementType } from "@/lib/editor/types";

// Screenplay-natural display order (differs from Tab-cycle order).
const TOOLBAR_ELEMENTS: ElementType[] = [
  "scene_heading",
  "action",
  "character",
  "parenthetical",
  "dialogue",
  "transition",
];

type Props = { editor: Editor | null };

export default function EditorToolbar({ editor }: Props) {
  const currentElementType = useScriptForgeStore((s) => s.currentElementType);

  const handleSetElement = (type: ElementType) => {
    if (!editor) return;
    editor.commands.setNode(type);
    editor.commands.focus();
  };

  return (
    <div className="flex items-center justify-between px-4 h-12 shrink-0 border-b border-[var(--color-border-subtle)]">
      <div className="flex items-center gap-0.5 w-[160px]">
        <ToolButton
          icon={<Upload size={13} />}
          label="Load"
          onClick={() => console.log("Load clicked")}
        />
        <ToolButton
          icon={<Download size={13} />}
          label="Download"
          onClick={() => console.log("Download clicked")}
        />
      </div>

      <div className="flex items-center gap-0.5 bg-[var(--color-surface)] rounded-md p-0.5">
        {TOOLBAR_ELEMENTS.map((type) => {
          const active = type === currentElementType;
          return (
            <button
              key={type}
              disabled={!editor}
              onClick={() => handleSetElement(type)}
              className={[
                "px-2.5 py-1 text-[11px] font-sans rounded transition-colors whitespace-nowrap",
                active
                  ? "bg-indigo-600 text-white"
                  : "text-[var(--color-fg-secondary)] hover:text-indigo-400 hover:bg-[var(--color-border-subtle)] disabled:opacity-40",
              ].join(" ")}
            >
              <span className="hidden lg:inline">{ELEMENT_DISPLAY_NAMES[type]}</span>
              <span className="lg:hidden">{SHORT_NAMES[type]}</span>
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-end w-[160px]">
        <ToolButton
          icon={<Wand2 size={13} />}
          label="Auto-fix"
          onClick={() => console.log("Auto-fix clicked")}
        />
      </div>
    </div>
  );
}

const SHORT_NAMES: Record<ElementType, string> = {
  scene_heading: "Scn",
  action: "Act",
  character: "Chr",
  dialogue: "Dlg",
  parenthetical: "Par",
  transition: "Trn",
};

function ToolButton({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-[var(--color-fg-secondary)] hover:text-indigo-400 text-[12px] font-sans transition-colors"
      title={label}
    >
      {icon}
      {label}
    </button>
  );
}
