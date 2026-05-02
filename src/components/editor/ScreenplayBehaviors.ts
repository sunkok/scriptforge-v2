import { Extension } from "@tiptap/core";
import { Plugin, PluginKey, TextSelection } from "@tiptap/pm/state";
import { isElementType, type ElementType } from "@/lib/editor/types";

const behaviorPluginKey = new PluginKey("screenplayBehaviors");

// See docs/writing-flow.md for the reasoning behind these tables.

const TAB_MAP: Record<ElementType, ElementType> = {
  scene_heading: "action",
  action:        "character",
  character:     "parenthetical",
  parenthetical: "dialogue",
  dialogue:      "character",
  transition:    "scene_heading",
};

const SHIFT_TAB_MAP: Record<ElementType, ElementType> = {
  scene_heading: "transition",
  action:        "scene_heading",
  character:     "action",
  parenthetical: "character",
  dialogue:      "character", // may be overridden to "parenthetical" if prev block qualifies
  transition:    "dialogue",
};

const ENTER_MAP: Record<ElementType, ElementType> = {
  scene_heading: "action",
  action:        "action",
  character:     "dialogue",
  dialogue:      "action",
  parenthetical: "dialogue",
  transition:    "scene_heading",
};

const UPPERCASE_TYPES = new Set<ElementType>(["scene_heading", "character", "transition"]);


export const ScreenplayBehaviors = Extension.create({
  name: "screenplayBehaviors",

  addKeyboardShortcuts() {
    return {
      Tab: ({ editor }) => {
        const currentType = editor.state.selection.$anchor.parent.type.name;
        if (!isElementType(currentType)) return false;
        return editor.commands.setNode(TAB_MAP[currentType]);
      },

      "Shift-Tab": ({ editor }) => {
        const { $anchor } = editor.state.selection;
        const currentType = $anchor.parent.type.name;
        if (!isElementType(currentType)) return false;

        let targetType = SHIFT_TAB_MAP[currentType];

        // From Dialogue: go to Parenthetical only if the immediately preceding
        // sibling block within the same page is a non-empty Parenthetical.
        if (currentType === "dialogue") {
          const parentOffset = $anchor.start(-1); // start of the page node
          const nodeStart = $anchor.before();      // start of the dialogue node
          const relPos = nodeStart - parentOffset;

          const pageNode = $anchor.node(-1);
          let prevNode: typeof pageNode | null = null;
          pageNode.forEach((child, offset) => {
            if (offset + child.nodeSize === relPos) prevNode = child;
          });

          if (
            prevNode &&
            (prevNode as typeof pageNode).type.name === "parenthetical" &&
            (prevNode as typeof pageNode).textContent.trim() !== ""
          ) {
            targetType = "parenthetical";
          }
        }

        return editor.commands.setNode(targetType);
      },

      Enter: ({ editor }) => {
        const { $anchor } = editor.state.selection;
        const currentType = $anchor.parent.type.name;
        if (!isElementType(currentType)) return false;

        const isEmpty = $anchor.parent.textContent === "";

        // Empty Action → Character (start dialogue exchange)
        if (currentType === "action" && isEmpty) {
          return editor.commands.setNode("character");
        }
        // Empty Character → Action (cancel speaker, return to description)
        if (currentType === "character" && isEmpty) {
          return editor.commands.setNode("action");
        }

        const nextType = ENTER_MAP[currentType];
        // Chain tracks stale positions after splitBlock; run sequentially instead.
        editor.commands.splitBlock();
        return editor.commands.setNode(nextType);
      },

      // Cmd/Ctrl+1–6: set element type directly without Tab cycling.
      "Mod-1": ({ editor }) => {
        if (!isElementType(editor.state.selection.$anchor.parent.type.name)) return false;
        return editor.commands.setNode("scene_heading");
      },
      "Mod-2": ({ editor }) => {
        if (!isElementType(editor.state.selection.$anchor.parent.type.name)) return false;
        return editor.commands.setNode("action");
      },
      "Mod-3": ({ editor }) => {
        if (!isElementType(editor.state.selection.$anchor.parent.type.name)) return false;
        return editor.commands.setNode("character");
      },
      "Mod-4": ({ editor }) => {
        if (!isElementType(editor.state.selection.$anchor.parent.type.name)) return false;
        return editor.commands.setNode("dialogue");
      },
      "Mod-5": ({ editor }) => {
        if (!isElementType(editor.state.selection.$anchor.parent.type.name)) return false;
        return editor.commands.setNode("parenthetical");
      },
      "Mod-6": ({ editor }) => {
        if (!isElementType(editor.state.selection.$anchor.parent.type.name)) return false;
        return editor.commands.setNode("transition");
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
