"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useEditor, EditorContent } from "@tiptap/react";
import Document from "@tiptap/extension-document";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Placeholder from "@tiptap/extension-placeholder";
import { PageNode } from "@/components/editor/PageNode";
import { PaginationEngineContext } from "@/components/editor/PaginationContext";
import { PaginationEngine } from "@/lib/pagination/engine";
import {
  SceneHeading,
  Action,
  Character,
  Dialogue,
  Parenthetical,
  Transition,
} from "@/lib/editor/nodes";
import { fountainToTiptap } from "@/lib/fountain/parser";
import { useScriptForgeStore } from "@/lib/store";

const CustomDocument = Document.extend({ content: "page+" });

interface Props {
  label: string;
  fountain: string;
  onClose: () => void;
}

export default function ViewSnapshotModal({ label, fountain, onClose }: Props) {
  const editorTheme = useScriptForgeStore((s) => s.editorTheme);
  const [engine, setEngine] = useState<PaginationEngine | null>(null);
  const engineRef = useRef<PaginationEngine | null>(null);

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
      Underline,
      Placeholder.configure({ showOnlyCurrent: false, placeholder: () => "" }),
    ],
    content: fountainToTiptap(fountain),
    editable: false,
    immediatelyRender: false,

    onCreate({ editor }) {
      const eng = new PaginationEngine();
      eng.setEditor(editor);
      engineRef.current = eng;
      setEngine(eng);
    },

    onDestroy() {
      engineRef.current?.destroy();
      engineRef.current = null;
    },
  });

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex flex-col"
      style={{ background: "#0b0b10" }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-6 py-3 shrink-0"
        style={{
          background: "rgba(16, 16, 22, 0.88)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          borderBottom: "1px solid rgba(255, 255, 255, 0.07)",
        }}
      >
        <span
          className="text-white font-semibold font-sans text-[15px] truncate"
          title={label}
        >
          Viewing: {label}
        </span>
        <button
          onClick={onClose}
          className="ml-4 shrink-0 p-1 rounded text-[#6b6b76] hover:text-white transition-colors"
          title="Close (Esc)"
        >
          <X size={16} />
        </button>
      </div>

      {/* Read-only editor */}
      <div className={`flex-1 overflow-y-auto py-10${editorTheme === "dark" ? " theme-dark" : ""}`}>
        <PaginationEngineContext.Provider value={engine}>
          <EditorContent editor={editor} />
        </PaginationEngineContext.Provider>
      </div>
    </div>,
    document.body
  );
}
