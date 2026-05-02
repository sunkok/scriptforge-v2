import { Node, mergeAttributes } from "@tiptap/core";

export const Dialogue = Node.create({
  name: "dialogue",
  group: "block",
  content: "inline*",

  parseHTML() {
    return [{ tag: 'p[data-element-type="dialogue"]', priority: 100 }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "p",
      mergeAttributes({ "data-element-type": "dialogue" }, HTMLAttributes),
      0,
    ];
  },
});
