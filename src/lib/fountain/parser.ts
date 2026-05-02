import { Fountain } from "fountain-js";
import type { JSONContent } from "@tiptap/core";

const TOKEN_TYPE_MAP: Record<string, string> = {
  scene_heading: "scene_heading",
  "scene-heading": "scene_heading", // defensive: handle either separator
  action: "action",
  character: "character",
  parenthetical: "parenthetical",
  dialogue: "dialogue",
  transition: "transition",
};

const EMPTY_DOC: JSONContent = {
  type: "doc",
  content: [{ type: "page", content: [{ type: "scene_heading" }] }],
};

/**
 * Parses a Fountain-format string and returns a Tiptap JSONContent document
 * using v2's separate node types (scene_heading, action, character, etc.)
 * wrapped in a single page node.
 *
 * Token types not in TOKEN_TYPE_MAP (dialogue_begin, dialogue_end, note,
 * section, title_page, etc.) are silently ignored.
 */
export function fountainToTiptap(fountainText: string): JSONContent {
  if (!fountainText.trim()) return EMPTY_DOC;

  const fountain = new Fountain();
  const result = fountain.parse(fountainText, true);
  const tokens = result.tokens ?? [];

  const nodes: JSONContent[] = [];

  for (const token of tokens) {
    const nodeType = TOKEN_TYPE_MAP[token.type];
    if (!nodeType) continue;

    const text = (token.text ?? "").trim();
    if (!text) continue;

    nodes.push({
      type: nodeType,
      content: [{ type: "text", text }],
    });
  }

  if (nodes.length === 0) return EMPTY_DOC;

  return {
    type: "doc",
    content: [{ type: "page", content: nodes }],
  };
}
