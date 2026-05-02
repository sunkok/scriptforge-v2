import type { JSONContent } from "@tiptap/core";

function extractText(node: JSONContent): string {
  if (node.type === "text") return node.text ?? "";
  if (!node.content) return "";
  return node.content.map(extractText).join("");
}

export function proseMirrorDocToFountain(doc: JSONContent): string {
  const blocks: string[] = [];

  function walk(node: JSONContent) {
    if (!node.content) return;
    for (const child of node.content) {
      if (child.type === "doc" || child.type === "page") {
        walk(child);
      } else {
        const text = extractText(child);
        blocks.push(text);
      }
    }
  }

  walk(doc);
  return blocks.join("\n\n");
}
