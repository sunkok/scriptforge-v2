import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import type { Annotation } from "@/lib/types";
import { buildAnchorMap } from "@/lib/fountain/anchor-mapping";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    annotationDecorations: {
      setAnnotations: (annotations: Annotation[]) => ReturnType;
    };
  }
}

const annotationKey = new PluginKey<PluginState>("annotationDecorations");

type PluginState = {
  annotations: Annotation[];
  decorations: DecorationSet;
};

function buildDecorations(
  doc: Parameters<typeof buildAnchorMap>[0],
  annotations: Annotation[]
): DecorationSet {
  const { fountainToTiptap } = buildAnchorMap(doc);
  const decos: Decoration[] = [];

  for (const ann of annotations) {
    if (ann.parentId !== null) continue; // top-level only

    const from = fountainToTiptap.get(ann.anchorStart);
    const to = fountainToTiptap.get(ann.anchorEnd - 1);
    if (from === undefined || to === undefined) continue;

    decos.push(
      Decoration.inline(from, to + 1, {
        class: ann.resolvedAt
          ? "annotation-highlight resolved"
          : "annotation-highlight",
        "data-annotation-id": ann.id,
      })
    );
  }

  return DecorationSet.create(doc, decos);
}

export const AnnotationDecorations = Extension.create({
  name: "annotationDecorations",

  addProseMirrorPlugins() {
    return [
      new Plugin<PluginState>({
        key: annotationKey,

        state: {
          init(_config, state) {
            return {
              annotations: [],
              decorations: DecorationSet.empty,
            };
          },

          apply(tr, prev, _oldState, newState) {
            const meta = tr.getMeta(annotationKey) as Annotation[] | undefined;

            if (meta !== undefined) {
              return {
                annotations: meta,
                decorations: buildDecorations(newState.doc, meta),
              };
            }

            if (tr.docChanged) {
              return {
                annotations: prev.annotations,
                decorations: prev.decorations.map(tr.mapping, tr.doc),
              };
            }

            return prev;
          },
        },

        props: {
          decorations(state) {
            return annotationKey.getState(state)?.decorations ?? DecorationSet.empty;
          },
        },
      }),
    ];
  },

  addCommands() {
    return {
      setAnnotations:
        (annotations: Annotation[]) =>
        ({ tr, dispatch }) => {
          if (dispatch) {
            tr.setMeta(annotationKey, annotations);
            dispatch(tr);
          }
          return true;
        },
    };
  },
});
