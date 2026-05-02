import type { JSONContent } from "@tiptap/core";
import type { ScriptTitleBlock } from "@/lib/types";

function getNodeText(node: JSONContent): string {
  if (node.type === "text") return node.text ?? "";
  if (!node.content) return "";
  return node.content.map(getNodeText).join("");
}

function buildTitleSection(tb: ScriptTitleBlock): string {
  const lines: string[] = [];
  if (tb.title) lines.push(`Title: ${tb.title}`);
  if (tb.author) lines.push(`Author: ${tb.author}`);
  if (tb.draft) lines.push(`Draft: ${tb.draft}`);
  if (tb.date) lines.push(`Date: ${tb.date}`);
  if (tb.contact) {
    const contactLines = tb.contact.split("\n");
    lines.push(`Contact: ${contactLines[0]}`);
    for (const line of contactLines.slice(1)) {
      lines.push(`    ${line}`);
    }
  }
  if (tb.source) lines.push(`Source: ${tb.source}`);
  return lines.length > 0 ? lines.join("\n") + "\n\n\n" : "";
}

/**
 * Converts a v2 Tiptap document (doc > page+ > block+) into a Fountain string.
 * Switches on node.type directly (v2 uses separate node types, not attrs).
 */
export function tiptapToFountain(doc: JSONContent, titleBlock?: ScriptTitleBlock): string {
  if (!doc.content) return "";

  const prefix = titleBlock ? buildTitleSection(titleBlock) : "";
  const chunks: string[] = [];

  for (const page of doc.content) {
    if (page.type !== "page" || !page.content) continue;

    for (const node of page.content) {
      const raw = getNodeText(node).trim();
      if (!raw) continue;

      switch (node.type) {
        case "scene_heading":
          chunks.push(raw.toUpperCase() + "\n\n");
          break;

        case "action":
          chunks.push(raw + "\n\n");
          break;

        case "character":
          // No blank line after — dialogue/parenthetical follows immediately
          chunks.push(raw.toUpperCase() + "\n");
          break;

        case "parenthetical": {
          const wrapped =
            raw.startsWith("(") && raw.endsWith(")") ? raw : `(${raw})`;
          chunks.push(wrapped + "\n");
          break;
        }

        case "dialogue":
          chunks.push(raw + "\n\n");
          break;

        case "transition": {
          let t = raw.toUpperCase();
          if (!t.endsWith(":") && !t.endsWith(".")) t += ":";
          chunks.push(t + "\n\n");
          break;
        }
      }
    }
  }

  return (prefix + chunks.join("")).trimEnd();
}
