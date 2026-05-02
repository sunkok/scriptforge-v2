import { Fountain } from "fountain-js";
import type { JSONContent } from "@tiptap/core";

// fountain-js misses some transition patterns (e.g. "TIME CUT:"). Post-pass
// detects action/scene_heading nodes whose text looks like a transition.
const TRANSITION_RE =
  /^(FADE\s+(IN|OUT|TO\s+BLACK)|CUT\s+TO(\s+BLACK)?|DISSOLVE\s+TO|SMASH\s+CUT\s+TO|MATCH\s+CUT\s+TO|TIME\s+CUT)[:.!]?$/i;

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

// Fountain inline markup patterns (priority order: bold-italic before bold before italic).
// Capture groups: [1]=bold+italic content, [2]=bold, [3]=italic, [4]=underline.
const INLINE_MARK_RE = /\*{3}(.+?)\*{3}|\*{2}(.+?)\*{2}|\*(.+?)\*|_([^_\n]+)_/g;

/**
 * Parses a Fountain token's text (which may contain **bold**, *italic*, _underline_
 * markup) into an array of Tiptap text nodes with the appropriate marks.
 */
function parseInlineMarks(raw: string): JSONContent[] {
  const nodes: JSONContent[] = [];
  let lastIndex = 0;

  const re = new RegExp(INLINE_MARK_RE.source, "g");
  let match: RegExpExecArray | null;

  while ((match = re.exec(raw)) !== null) {
    if (match.index > lastIndex) {
      nodes.push({ type: "text", text: raw.slice(lastIndex, match.index) });
    }

    const [full, boldItalicContent, boldContent, italicContent, underlineContent] = match;
    const marks: { type: string }[] = [];
    let content = "";

    if (boldItalicContent !== undefined) {
      content = boldItalicContent;
      marks.push({ type: "bold" }, { type: "italic" });
    } else if (boldContent !== undefined) {
      content = boldContent;
      marks.push({ type: "bold" });
    } else if (italicContent !== undefined) {
      content = italicContent;
      marks.push({ type: "italic" });
    } else if (underlineContent !== undefined) {
      content = underlineContent;
      marks.push({ type: "underline" });
    }

    if (content) {
      nodes.push(marks.length > 0
        ? { type: "text", text: content, marks }
        : { type: "text", text: content }
      );
    }

    lastIndex = match.index + full.length;
  }

  if (lastIndex < raw.length) {
    nodes.push({ type: "text", text: raw.slice(lastIndex) });
  }

  return nodes.length > 0 ? nodes : [{ type: "text", text: raw }];
}

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
      content: parseInlineMarks(text),
    });
  }

  // Post-pass: fix transitions fountain-js doesn't recognize (e.g. "TIME CUT:")
  for (const node of nodes) {
    if (node.type === "action" || node.type === "scene_heading") {
      const text = node.content?.[0]?.text ?? "";
      if (TRANSITION_RE.test(text)) node.type = "transition";
    }
  }

  if (nodes.length === 0) return EMPTY_DOC;

  return {
    type: "doc",
    content: [{ type: "page", content: nodes }],
  };
}
