import type { ScriptTitleBlock } from "@/lib/types";

/**
 * Extracts title block key-value pairs from the top of a Fountain file.
 * Returns undefined if no recognized title fields are found.
 */
export function parseTitleBlock(fountainText: string): ScriptTitleBlock | undefined {
  const lines = fountainText.split("\n");
  const block: ScriptTitleBlock = {};
  let hasFields = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Two consecutive blank lines = end of title page
    if (line.trim() === "") {
      if (i + 1 < lines.length && lines[i + 1].trim() === "") break;
      continue;
    }

    // Continuation line (indented) — skip for simple parsing
    if (/^\s/.test(line)) continue;

    const colonIdx = line.indexOf(":");
    if (colonIdx <= 0) break; // not a key: value line; end of title block

    const key = line.slice(0, colonIdx).trim().toLowerCase();
    const value = line.slice(colonIdx + 1).trim();
    if (!value) continue;

    switch (key) {
      case "title":
        block.title = value;
        hasFields = true;
        break;
      case "author":
      case "authors":
        block.author = value;
        hasFields = true;
        break;
      case "draft":
      case "draft date":
        block.draft = value;
        hasFields = true;
        break;
      case "date":
        block.date = value;
        hasFields = true;
        break;
      case "contact":
        block.contact = value;
        hasFields = true;
        break;
      case "source":
        block.source = value;
        hasFields = true;
        break;
    }
  }

  return hasFields ? block : undefined;
}
