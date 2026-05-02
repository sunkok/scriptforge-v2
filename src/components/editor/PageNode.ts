import { Node } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import PageNodeView from "./PageNodeView";

export const PageNode = Node.create({
  name: "page",
  group: "block",
  content: "block+",
  isolating: true,

  parseHTML() {
    return [{ tag: 'div[data-type="page"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", { "data-type": "page", ...HTMLAttributes }, 0];
  },

  addNodeView() {
    return ReactNodeViewRenderer(PageNodeView);
  },
});
