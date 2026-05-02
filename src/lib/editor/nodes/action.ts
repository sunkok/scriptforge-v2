import { Node, mergeAttributes } from "@tiptap/core";

export const Action = Node.create({
  name: "action",
  group: "block",
  content: "inline*",

  parseHTML() {
    return [{ tag: 'p[data-element-type="action"]', priority: 100 }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "p",
      mergeAttributes({ "data-element-type": "action" }, HTMLAttributes),
      0,
    ];
  },
});
