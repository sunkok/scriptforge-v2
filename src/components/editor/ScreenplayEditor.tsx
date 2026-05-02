"use client";

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
  });

  return (
    <div className="min-h-screen bg-[var(--color-canvas)] overflow-y-auto py-10">
      <EditorContent editor={editor} />
    </div>
  );
}
