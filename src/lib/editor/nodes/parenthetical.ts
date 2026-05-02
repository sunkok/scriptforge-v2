import { Node, mergeAttributes } from "@tiptap/core";

export const Parenthetical = Node.create({
  name: "parenthetical",
  group: "block",
  content: "inline*",

  parseHTML() {
    return [{ tag: 'p[data-element-type="parenthetical"]', priority: 100 }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "p",
      mergeAttributes({ "data-element-type": "parenthetical" }, HTMLAttributes),
      0,
    ];
  },
});
