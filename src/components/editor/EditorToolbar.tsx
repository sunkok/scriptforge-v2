"use client";

import { useRef } from "react";
import { Upload, Download, Wand2 } from "lucide-react";
import type { Editor } from "@tiptap/core";
import { useScriptForgeStore } from "@/lib/store";
import { ELEMENT_DISPLAY_NAMES, type ElementType } from "@/lib/editor/types";
import { fountainToTiptap } from "@/lib/fountain/parser";
import { tiptapToFountain } from "@/lib/fountain/serializer";
import { parseTitleBlock } from "@/lib/fountain/title-block";

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
  const scriptTitle = useScriptForgeStore((s) => s.scriptTitle);
  const titleBlock = useScriptForgeStore((s) => s.titleBlock);
  const setTitleBlock = useScriptForgeStore((s) => s.setTitleBlock);
  const setScriptMeta = useScriptForgeStore((s) => s.setScriptMeta);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSetElement = (type: ElementType) => {
    if (!editor) return;
    editor.commands.setNode(type);
    editor.commands.focus();
  };

  function handleLoadClick() {
    fileInputRef.current?.click();
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !editor) return;

    const confirmed = window.confirm(
      "Loading a file will replace the current script. Continue?"
    );
    // Reset input so the same file can be re-selected later
    e.target.value = "";

    if (!confirmed) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result;
      if (typeof text !== "string") return;
      const tb = parseTitleBlock(text);
      setTitleBlock(tb);
      if (tb) {
        setScriptMeta({
          title: tb.title ?? "",
          author: tb.author ?? "",
          contact: tb.contact ?? "",
          draftLabel: tb.draft ?? "",
        });
      }
      editor.commands.setContent(fountainToTiptap(text));
      editor.commands.focus();
    };
    reader.readAsText(file);
  }

  function handleDownload() {
    if (!editor) return;
    const fountain = tiptapToFountain(editor.state.doc.toJSON(), titleBlock);
    const blob = new Blob([fountain], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const filename = (scriptTitle || "untitled").replace(/[^\w\s-]/g, "").trim() || "untitled";
    a.href = url;
    a.download = `${filename}.fountain`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".fountain,.txt"
        className="hidden"
        onChange={handleFileChange}
      />

      <div className="flex items-center justify-between px-4 h-12 shrink-0 border-b border-[var(--color-border-subtle)]">
        <div className="flex items-center gap-0.5 w-[160px]">
          <ToolButton
            icon={<Upload size={13} />}
            label="Load"
            onClick={handleLoadClick}
          />
          <ToolButton
            icon={<Download size={13} />}
            label="Download"
            onClick={handleDownload}
            disabled={!editor}
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
    </>
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
  disabled,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-[var(--color-fg-secondary)] hover:text-indigo-400 text-[12px] font-sans transition-colors disabled:opacity-40"
      title={label}
    >
      {icon}
      {label}
    </button>
  );
}
