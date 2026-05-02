"use client";

import { useState, useRef } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import Document from "@tiptap/extension-document";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { PageNode } from "./PageNode";
import { ScreenplayBehaviors } from "./ScreenplayBehaviors";
import {
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

const CustomDocument = Document.extend({ content: "page+" });

const PLACEHOLDERS: Record<string, string> = {
  scene_heading: "INT. LOCATION - DAY",
  action: "Action...",
  character: "CHARACTER",
  dialogue: "Dialogue...",
  parenthetical: "(beat)",
  transition: "FADE OUT:",
};

const INITIAL_CONTENT = {
  type: "doc",
  content: [
    {
      type: "page",
      content: [{ type: "scene_heading" }],
    },
  ],
};

export default function ScreenplayEditor() {
  const [engine, setEngine] = useState<PaginationEngine | null>(null);
  const [activePage, setActivePage] = useState(1);
  // Keep an imperative ref for cleanup in onDestroy (setEngine is async).
  const engineRef = useRef<PaginationEngine | null>(null);
  const pageCount = useScriptForgeStore((s) => s.pageCount);
  const setPageCount = useScriptForgeStore((s) => s.setPageCount);

  const editor = useEditor({
    extensions: [
      CustomDocument,
      StarterKit.configure({ document: false }),
      PageNode,
      SceneHeading,
      Action,
      Character,
      Dialogue,
      Parenthetical,
      Transition,
      ScreenplayBehaviors,
      Placeholder.configure({
        showOnlyCurrent: false,
        placeholder: ({ node }) => PLACEHOLDERS[node.type.name] ?? "",
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
    },

    onSelectionUpdate({ editor }) {
      const { $anchor } = editor.state.selection;
      let page = 1;
      editor.state.doc.forEach((node, offset) => {
        if (node.type.name !== "page") return;
        // If the anchor is past this page's end, the cursor is on a later page.
        if ($anchor.pos > offset + node.nodeSize) page++;
      });
      setActivePage(page);
    },
  });

  return (
    <PaginationEngineContext.Provider value={engine}>
      <div className="h-screen bg-[var(--color-canvas)] overflow-y-auto py-10">
        <EditorContent editor={editor} />
      </div>
      <div className="fixed bottom-4 right-4 text-indigo-400 text-xs font-mono pointer-events-none select-none">
        {activePage} / {pageCount}
      </div>
    </PaginationEngineContext.Provider>
  );
}
