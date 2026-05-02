import { Node, mergeAttributes } from "@tiptap/core";

export type TitleFieldRole = "title" | "writtenby" | "author" | "contact";

export const TitleField = Node.create({
  name: "title_field",
  // No group — only valid as a child of title_block.
  content: "inline*",

  addAttributes() {
    return {
      role: {
        default: "title" as TitleFieldRole,
        parseHTML: (el) => el.getAttribute("data-role"),
        renderHTML: (attrs) => ({ "data-role": attrs.role }),
      },
    };
  },

  parseHTML() {
    return [{ tag: "p[data-role]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["p", mergeAttributes(HTMLAttributes), 0];
  },
});
