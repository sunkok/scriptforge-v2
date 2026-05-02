import { Node, mergeAttributes } from "@tiptap/core";

export const SceneHeading = Node.create({
  name: "scene_heading",
  group: "block",
  content: "inline*",

  parseHTML() {
    return [{ tag: 'p[data-element-type="scene_heading"]', priority: 100 }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "p",
      mergeAttributes({ "data-element-type": "scene_heading" }, HTMLAttributes),
      0,
    ];
  },
});
