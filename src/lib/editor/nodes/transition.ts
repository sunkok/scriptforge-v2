import { Node, mergeAttributes } from "@tiptap/core";

export const Transition = Node.create({
  name: "transition",
  group: "block",
  content: "inline*",

  parseHTML() {
    return [{ tag: 'p[data-element-type="transition"]', priority: 100 }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "p",
      mergeAttributes({ "data-element-type": "transition" }, HTMLAttributes),
      0,
    ];
  },
});
