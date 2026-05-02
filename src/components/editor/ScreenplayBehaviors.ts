import { Extension } from "@tiptap/core";
import { Plugin, PluginKey, TextSelection } from "@tiptap/pm/state";
import { isElementType, type ElementType } from "@/lib/editor/types";

const behaviorPluginKey = new PluginKey("screenplayBehaviors");

// See docs/writing-flow.md for the full rationale behind these tables.

// Tab: creates a NEW LINE below with the target type.
const TAB_MAP: Record<ElementType, ElementType> = {
  scene_heading: "action",
  action:        "character",
  character:     "parenthetical",
  parenthetical: "dialogue",
  dialogue:      "character",
  transition:    "scene_heading",
};

// Shift+Tab: RELABELS the current line in place (no new line).
const SHIFT_TAB_MAP: Record<ElementType, ElementType> = {
  scene_heading: "transition",
  action:        "scene_heading",
  character:     "action",
  parenthetical: "character",
  dialogue:      "character",
  transition:    "dialogue",
};

// Enter: creates a NEW LINE below with the target type.
// Empty Action/Character are handled separately before this table is consulted.
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
      // Tab: done here → create new line below for next likely element.
      Tab: ({ editor }) => {
        const { $anchor } = editor.state.selection;
        const currentType = $anchor.parent.type.name;
        if (!isElementType(currentType)) return false;

        const targetType = TAB_MAP[currentType];

        editor.commands.splitBlock();
        return editor.commands.setNode(targetType);
      },

      // Shift+Tab: relabel CURRENT line to a different type — no new line.
      "Shift-Tab": ({ editor }) => {
        const currentType = editor.state.selection.$anchor.parent.type.name;
        if (!isElementType(currentType)) return false;
        return editor.commands.setNode(SHIFT_TAB_MAP[currentType]);
      },

      // Enter: smart empty-state first, then standard forward progression.
      Enter: ({ editor }) => {
        const { $anchor } = editor.state.selection;
        const currentType = $anchor.parent.type.name;
        if (!isElementType(currentType)) return false;

        const isEmpty = $anchor.parent.textContent === "";

        // Empty Action → relabel to Character on the SAME line (no new line).
        if (currentType === "action" && isEmpty) {
          return editor.commands.setNode("character");
        }
        // Empty Character → relabel to Action on the SAME line (no new line).
        if (currentType === "character" && isEmpty) {
          return editor.commands.setNode("action");
        }

        // Standard case: create new line with the target type.
        // Chain tracks stale positions after splitBlock; run sequentially instead.
        editor.commands.splitBlock();
        return editor.commands.setNode(ENTER_MAP[currentType]);
      },

      // Cmd/Ctrl+1–6: relabel current line to a specific type directly.
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
