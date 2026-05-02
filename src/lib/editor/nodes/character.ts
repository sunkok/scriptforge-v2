import { Node, mergeAttributes } from "@tiptap/core";

export const Character = Node.create({
  name: "character",
  group: "block",
  content: "inline*",

  parseHTML() {
    return [{ tag: 'p[data-element-type="character"]', priority: 100 }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "p",
      mergeAttributes({ "data-element-type": "character" }, HTMLAttributes),
      0,
    ];
  },
});
