import { Extension } from "@tiptap/core";
import { Plugin, PluginKey, TextSelection } from "@tiptap/pm/state";
import { ELEMENT_CYCLE, type ElementType } from "@/lib/editor/types";

const behaviorPluginKey = new PluginKey("screenplayBehaviors");

const ENTER_MAP: Record<ElementType, ElementType> = {
  scene_heading: "action",
  action: "action",
  character: "dialogue",
  dialogue: "action",
  parenthetical: "dialogue",
  transition: "scene_heading",
};

const UPPERCASE_TYPES = new Set<ElementType>(["scene_heading", "character", "transition"]);

function isElementType(name: string): name is ElementType {
  return ELEMENT_CYCLE.includes(name as ElementType);
}

export const ScreenplayBehaviors = Extension.create({
  name: "screenplayBehaviors",

  addKeyboardShortcuts() {
    return {
      Tab: ({ editor }) => {
        const currentType = editor.state.selection.$anchor.parent.type.name;
        if (!isElementType(currentType)) return false;
        const idx = ELEMENT_CYCLE.indexOf(currentType);
        const nextType = ELEMENT_CYCLE[(idx + 1) % ELEMENT_CYCLE.length];
        return editor.commands.setNode(nextType);
      },

      "Shift-Tab": ({ editor }) => {
        const currentType = editor.state.selection.$anchor.parent.type.name;
        if (!isElementType(currentType)) return false;
        const idx = ELEMENT_CYCLE.indexOf(currentType);
        const prevType =
          ELEMENT_CYCLE[(idx - 1 + ELEMENT_CYCLE.length) % ELEMENT_CYCLE.length];
        return editor.commands.setNode(prevType);
      },

      Enter: ({ editor }) => {
        const { $anchor } = editor.state.selection;
        const currentType = $anchor.parent.type.name;
        if (!isElementType(currentType)) return false;
        const nextType = ENTER_MAP[currentType];
        return editor.chain().splitBlock().setNode(nextType).run();
      },
    };
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: behaviorPluginKey,
        props: {
          handleTextInput(view, from, to, text) {
            const { state } = view;
            const $from = state.doc.resolve(from);
            const typeName = $from.parent.type.name;

            if (UPPERCASE_TYPES.has(typeName as ElementType)) {
              const upper = text.toUpperCase();
              if (upper !== text) {
                view.dispatch(state.tr.insertText(upper, from, to));
                return true;
              }
            }

            if (typeName === "parenthetical") {
              const nodeContent = $from.parent.textContent;
              if (nodeContent === "" && text !== "(") {
                const wrapped = "(" + text + ")";
                const tr = state.tr.insertText(wrapped, from, to);
                // Position cursor after the typed char and before the closing ")"
                const cursorPos = from + 1 + text.length;
                view.dispatch(tr.setSelection(TextSelection.create(tr.doc, cursorPos)));
                return true;
              }
            }

            return false;
          },
        },
      }),
    ];
  },
});
