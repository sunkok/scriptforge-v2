"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useEditor, EditorContent } from "@tiptap/react";
import Document from "@tiptap/extension-document";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Placeholder from "@tiptap/extension-placeholder";
import { PageNode } from "@/components/editor/PageNode";
import { PaginationEngineContext } from "@/components/editor/PaginationContext";
import {
  SceneHeading,
  Action,
  Character,
  Dialogue,
  Parenthetical,
  Transition,
} from "@/lib/editor/nodes";
import { fountainToTiptap } from "@/lib/fountain/parser";

const CustomDocument = Document.extend({ content: "page+" });

interface Props {
  label: string;
  fountain: string;
  onClose: () => void;
}

export default function ViewSnapshotModal({ label, fountain, onClose }: Props) {
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
        style={{ background: "#13131a", borderBottom: "1px solid #2a2a35" }}
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
      <div className="flex-1 overflow-y-auto py-10">
        <PaginationEngineContext.Provider value={null}>
          <EditorContent editor={editor} />
        </PaginationEngineContext.Provider>
      </div>
    </div>,
    document.body
  );
}
