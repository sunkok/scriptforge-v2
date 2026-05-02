import { Node, mergeAttributes } from "@tiptap/core";

export const TitleBlock = Node.create({
  name: "title_block",
  group: "block",
  content: "title_field+",
  // Isolating keeps arrow-key navigation from escaping the block mid-field.
  isolating: true,

  parseHTML() {
    return [{ tag: 'div[data-type="title-block"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes({ "data-type": "title-block" }, HTMLAttributes),
      0,
    ];
  },
});
