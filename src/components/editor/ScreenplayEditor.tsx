"use client";

import { useState, useRef } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import type { Editor } from "@tiptap/core";
import Document from "@tiptap/extension-document";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { PageNode } from "./PageNode";
import { ScreenplayBehaviors } from "./ScreenplayBehaviors";
import {
  TitleBlock,
  TitleField,
  SceneHeading,
  Action,
  Character,
  Dialogue,
  Parenthetical,
  Transition,
} from "@/lib/editor/nodes";
import { PaginationEngine } from "@/lib/pagination/engine";
import { PaginationEngineContext } from "./PaginationContext";
import { useScriptForgeStore } from "@/lib/store";
import SuggestPopup, { type SuggestPopupState } from "./SuggestPopup";
import { isElementType, ELEMENT_DISPLAY_NAMES } from "@/lib/editor/types";

const CustomDocument = Document.extend({ content: "page+" });

const PLACEHOLDERS: Record<string, string> = {
  scene_heading: "INT. LOCATION - DAY",
  action: "Action...",
  character: "CHARACTER",
  dialogue: "Dialogue...",
  parenthetical: "(beat)",
  transition: "FADE OUT:",
};

const TITLE_FIELD_PLACEHOLDERS: Record<string, string> = {
  title: "TITLE",
  writtenby: "Written by",
  author: "Author Name",
  contact: "Contact Info",
};

const INITIAL_CONTENT = {
  type: "doc",
  content: [
    {
      type: "page",
      content: [
        {
          type: "title_block",
          content: [
            { type: "title_field", attrs: { role: "title" } },
            { type: "title_field", attrs: { role: "writtenby" } },
            { type: "title_field", attrs: { role: "author" } },
            { type: "title_field", attrs: { role: "contact" } },
          ],
        },
        { type: "scene_heading" },
      ],
    },
  ],
};

// Derive suggest-popup state from the current editor state.
// Returns null when the popup should be hidden.
function getSuggestState(editor: Editor): SuggestPopupState {
  const { $anchor } = editor.state.selection;
  const typeName = $anchor.parent.type.name;
  if ($anchor.parent.textContent !== "") return null;

  if (typeName === "scene_heading" || typeName === "transition") {
    const coords = editor.view.coordsAtPos($anchor.pos);
    return {
      kind: typeName === "scene_heading" ? "scene_prefix" : "transition",
      top: coords.bottom,
      left: coords.left,
    };
  }
  return null;
}

export default function ScreenplayEditor() {
  const [engine, setEngine] = useState<PaginationEngine | null>(null);
  const [activePage, setActivePage] = useState(1);
  const [suggestState, setSuggestState] = useState<SuggestPopupState>(null);
  // Keep an imperative ref for cleanup in onDestroy (setEngine is async).
  const engineRef = useRef<PaginationEngine | null>(null);
  const pageCount = useScriptForgeStore((s) => s.pageCount);
  const setPageCount = useScriptForgeStore((s) => s.setPageCount);
  const currentElementType = useScriptForgeStore((s) => s.currentElementType);
  const setCurrentElementType = useScriptForgeStore((s) => s.setCurrentElementType);

  const editor = useEditor({
    extensions: [
      CustomDocument,
      StarterKit.configure({ document: false }),
      PageNode,
      TitleBlock,
      TitleField,
      SceneHeading,
      Action,
      Character,
      Dialogue,
      Parenthetical,
      Transition,
      ScreenplayBehaviors,
      Placeholder.configure({
        showOnlyCurrent: false,
        placeholder: ({ node }) => {
          if (node.type.name === "title_field") {
            return TITLE_FIELD_PLACEHOLDERS[node.attrs.role as string] ?? "";
          }
          return PLACEHOLDERS[node.type.name] ?? "";
        },
      }),
    ],
    content: INITIAL_CONTENT,
    immediatelyRender: false,

    onCreate({ editor }) {
      const eng = new PaginationEngine();
      eng.setEditor(editor);
      engineRef.current = eng;
      setEngine(eng);
      setPageCount(1);
    },

    onDestroy() {
      engineRef.current?.destroy();
      engineRef.current = null;
    },

    onUpdate({ editor }) {
      let count = 0;
      editor.state.doc.forEach((node) => {
        if (node.type.name === "page") count++;
      });
      setPageCount(count);
      setSuggestState(getSuggestState(editor));
    },

    onSelectionUpdate({ editor }) {
      const { $anchor } = editor.state.selection;

      // Status indicator: show current screenplay element type.
      const typeName = $anchor.parent.type.name;
      setCurrentElementType(isElementType(typeName) ? typeName : null);

      // Page counter.
      let page = 1;
      editor.state.doc.forEach((node, offset) => {
        if (node.type.name !== "page") return;
        if ($anchor.pos > offset + node.nodeSize) page++;
      });
      setActivePage(page);

      // Suggest popup.
      setSuggestState(getSuggestState(editor));
    },
  });

  const handleSuggestInsert = (text: string) => {
    if (!editor) return;
    editor.commands.insertContent(text);
    setSuggestState(null);
  };

  return (
    <PaginationEngineContext.Provider value={engine}>
      <div className="h-screen bg-[var(--color-canvas)] overflow-y-auto py-10">
        <EditorContent editor={editor} />
      </div>

      {editor && (
        <SuggestPopup
          editor={editor}
          state={suggestState}
          onInsert={handleSuggestInsert}
          onDismiss={() => setSuggestState(null)}
        />
      )}

      {currentElementType && (
        <div className="fixed bottom-4 left-4 text-indigo-400 text-xs font-sans pointer-events-none select-none">
          {ELEMENT_DISPLAY_NAMES[currentElementType]}
        </div>
      )}

      <div className="fixed bottom-4 right-4 text-indigo-400 text-xs font-mono pointer-events-none select-none">
        {activePage} / {pageCount}
      </div>
    </PaginationEngineContext.Provider>
  );
}
