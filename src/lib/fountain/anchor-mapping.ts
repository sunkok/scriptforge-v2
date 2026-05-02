import type { Node as ProseMirrorNode } from "@tiptap/pm/model";

// v2 element node type names (excludes page, title-block nodes)
const V2_ELEMENT_TYPES = new Set([
  "scene_heading",
  "action",
  "character",
  "parenthetical",
  "dialogue",
  "transition",
]);

// How many newline characters follow each element type in Fountain source.
// character/parenthetical have 1 (next line is dialogue/parenthetical).
// Everything else has 2 (blank-line separator).
function trailingNewlines(typeName: string): number {
  return typeName === "character" || typeName === "parenthetical" ? 1 : 2;
}

export type AnchorMap = {
  tiptapToFountain: Map<number, number>;
  fountainToTiptap: Map<number, number>;
};

/**
 * Builds a bidirectional character-level mapping between ProseMirror positions
 * and Fountain character offsets.
 *
 * v2 doc structure: doc → page+ → screenplay-element+
 * Each page node occupies pageOffset (opening token) + content + closing token.
 * Each element node occupies nodeOffset (opening) + text chars + closing.
 *
 * For page.forEach, nodeOffset is the element's position within the page's
 * content. Absolute tiptap position of the first character of an element:
 *   pageOffset (opening token of page) + 1 (enter page) + nodeOffset (element opening) + 1 (enter element)
 *   = pageOffset + nodeOffset + 2
 *
 * Empty elements still advance the Fountain offset by their trailing newlines,
 * preventing downstream positions from drifting.
 */
export function buildAnchorMap(doc: ProseMirrorNode): AnchorMap {
  const tiptapToFountain = new Map<number, number>();
  const fountainToTiptap = new Map<number, number>();

  let fountainOffset = 0;

  doc.forEach((page, pageOffset) => {
    page.forEach((node, nodeOffset) => {
      if (!V2_ELEMENT_TYPES.has(node.type.name)) return;

      const nodeContentStart = pageOffset + nodeOffset + 2;
      const text = node.textContent;

      for (let i = 0; i < text.length; i++) {
        tiptapToFountain.set(nodeContentStart + i, fountainOffset + i);
        fountainToTiptap.set(fountainOffset + i, nodeContentStart + i);
      }

      fountainOffset += text.length + trailingNewlines(node.type.name);
    });
  });

  return { tiptapToFountain, fountainToTiptap };
}
