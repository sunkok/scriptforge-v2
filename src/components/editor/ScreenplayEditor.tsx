"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import Document from "@tiptap/extension-document";
import StarterKit from "@tiptap/starter-kit";
import { PageNode } from "./PageNode";

const CustomDocument = Document.extend({ content: "page+" });

const INITIAL_CONTENT = {
  type: "doc",
  content: [
    {
      type: "page",
      content: [{ type: "paragraph" }],
    },
  ],
};

export default function ScreenplayEditor() {
  const editor = useEditor({
    extensions: [
      CustomDocument,
      StarterKit.configure({ document: false }),
      PageNode,
    ],
    content: INITIAL_CONTENT,
    immediatelyRender: false,
  });

  return (
    <div className="min-h-screen bg-[var(--color-canvas)] overflow-y-auto">
      <EditorContent editor={editor} />
    </div>
  );
}
