import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { checkElementFormatting, type FormattingIssue } from "./formatting-check";

export type IssueWithLocation = {
  nodePos: number;
  nodeType: string;
  originalText: string;
  issue: FormattingIssue;
};

export function scanDocument(doc: ProseMirrorNode): IssueWithLocation[] {
  const issues: IssueWithLocation[] = [];

  doc.forEach((pageNode, pageOffset) => {
    if (pageNode.type.name !== "page") return;

    pageNode.forEach((blockNode, blockOffset) => {
      const text = blockNode.textContent;
      if (!text.trim()) return;

      const issue = checkElementFormatting(blockNode.type.name, text);
      if (issue) {
        issues.push({
          // +1 for the page node's opening token
          nodePos: pageOffset + 1 + blockOffset,
          nodeType: blockNode.type.name,
          originalText: text,
          issue,
        });
      }
    });
  });

  return issues;
}
