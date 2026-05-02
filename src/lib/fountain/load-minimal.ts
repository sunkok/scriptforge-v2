import type { JSONContent } from "@tiptap/core";

const EMPTY_DOC: JSONContent = {
  type: "doc",
  content: [{ type: "page", content: [{ type: "scene_heading" }] }],
};

export function fountainToProseMirrorDoc(text: string): JSONContent {
  if (!text.trim()) return EMPTY_DOC;

  const blocks = text.split(/\n\n+/).filter((b) => b.trim());
  if (blocks.length === 0) return EMPTY_DOC;

  return {
    type: "doc",
    content: [
      {
        type: "page",
        content: blocks.map((block) => ({
          type: "action",
          content: [{ type: "text", text: block.trim() }],
        })),
      },
    ],
  };
}
