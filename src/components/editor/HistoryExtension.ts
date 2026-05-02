import { Extension } from "@tiptap/core";
import { history, undo, redo } from "@tiptap/pm/history";

export const History = Extension.create({
  name: "history",

  addProseMirrorPlugins() {
    return [history()];
  },

  addKeyboardShortcuts() {
    return {
      "Mod-z": ({ editor }) => undo(editor.state, editor.view.dispatch),
      "Mod-Shift-z": ({ editor }) => redo(editor.state, editor.view.dispatch),
      "Mod-y": ({ editor }) => redo(editor.state, editor.view.dispatch),
    };
  },
});
