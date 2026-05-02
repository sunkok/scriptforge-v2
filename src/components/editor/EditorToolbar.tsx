"use client";

import { useRef } from "react";
import { Upload, Download, Wand2, Bold, Italic, Underline, Strikethrough } from "lucide-react";
import type { Editor } from "@tiptap/core";
import { useEditorState } from "@tiptap/react";
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

  // Reactive active-mark state — updates whenever selection or doc changes.
  const { isBold, isItalic, isUnderline, isStrike } = useEditorState({
    editor,
    selector: (ctx) => ({
      isBold: ctx.editor?.isActive("bold") ?? false,
      isItalic: ctx.editor?.isActive("italic") ?? false,
      isUnderline: ctx.editor?.isActive("underline") ?? false,
      isStrike: ctx.editor?.isActive("strike") ?? false,
    }),
  }) ?? { isBold: false, isItalic: false, isUnderline: false, isStrike: false };

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
        {/* Left: Load + Download */}
        <div className="flex items-center gap-0.5 w-[100px]">
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

        {/* Center: element type pills */}
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

        {/* Right: formatting buttons + Auto-fix */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <FormatButton
              icon={<Bold size={12} />}
              label="Bold (⌘B)"
              active={isBold}
              onClick={() => editor?.chain().focus().toggleBold().run()}
              disabled={!editor}
            />
            <FormatButton
              icon={<Italic size={12} />}
              label="Italic (⌘I)"
              active={isItalic}
              onClick={() => editor?.chain().focus().toggleItalic().run()}
              disabled={!editor}
            />
            <FormatButton
              icon={<Underline size={12} />}
              label="Underline (⌘U)"
              active={isUnderline}
              onClick={() => editor?.chain().focus().toggleUnderline().run()}
              disabled={!editor}
            />
            <FormatButton
              icon={<Strikethrough size={12} />}
              label="Strikethrough (⌘⇧X)"
              active={isStrike}
              onClick={() => editor?.chain().focus().toggleStrike().run()}
              disabled={!editor}
            />
          </div>

          <div className="w-px h-4 bg-[var(--color-border-subtle)]" />

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

function FormatButton({
  icon,
  label,
  active,
  onClick,
  disabled,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={label}
      className={[
        "w-7 h-7 flex items-center justify-center rounded transition-colors disabled:opacity-40",
        active
          ? "bg-indigo-600/20 text-indigo-400"
          : "text-[var(--color-fg-secondary)] hover:text-indigo-400 hover:bg-[var(--color-border-subtle)]",
      ].join(" ")}
    >
      {icon}
    </button>
  );
}
