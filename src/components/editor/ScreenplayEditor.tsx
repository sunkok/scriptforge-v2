"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useEditor, EditorContent } from "@tiptap/react";
import type { Editor } from "@tiptap/core";
import Document from "@tiptap/extension-document";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { PageNode } from "./PageNode";
import { ScreenplayBehaviors } from "./ScreenplayBehaviors";
import {
  SceneHeading,
  Action,
  Character,
  Dialogue,
  Parenthetical,
  Transition,
} from "@/lib/editor/nodes";
import { PaginationEngine } from "@/lib/pagination/engine";
import { PaginationEngineContext } from "./PaginationContext";
import { useScriptForgeStore } from "@/lib/store";
import SuggestPopup, { type SuggestPopupState } from "./SuggestPopup";
import EditorHeader from "./EditorHeader";
import EditorToolbar from "./EditorToolbar";
import { isElementType, ELEMENT_DISPLAY_NAMES } from "@/lib/editor/types";
import { fountainToTiptap } from "@/lib/fountain/parser";
import { tiptapToFountain } from "@/lib/fountain/serializer";
import { parseTitleBlock } from "@/lib/fountain/title-block";

const CustomDocument = Document.extend({ content: "page+" });

const PLACEHOLDERS: Record<string, string> = {
  scene_heading: "INT. LOCATION - DAY",
  action: "Action...",
  character: "CHARACTER",
  dialogue: "Dialogue...",
  parenthetical: "(beat)",
  transition: "FADE OUT:",
};

const INITIAL_CONTENT = {
  type: "doc",
  content: [
    {
      type: "page",
      content: [{ type: "scene_heading" }],
    },
  ],
};

function getSuggestState(editor: Editor): SuggestPopupState {
  const { $anchor } = editor.state.selection;
  const typeName = $anchor.parent.type.name;
  if ($anchor.parent.textContent !== "") return null;

  if (typeName === "scene_heading" || typeName === "transition") {
    const coords = editor.view.coordsAtPos($anchor.pos);
    return {
      kind: typeName === "scene_heading" ? "scene_prefix" : "transition",
      top: coords.bottom,
      left: coords.left,
    };
  }
  return null;
}

interface Props {
  scriptId: string;
}

export default function ScreenplayEditor({ scriptId }: Props) {
  const router = useRouter();
  const [engine, setEngine] = useState<PaginationEngine | null>(null);
  const [activePage, setActivePage] = useState(1);
  const [suggestState, setSuggestState] = useState<SuggestPopupState>(null);
  const [loadError, setLoadError] = useState<"not_found" | "failed" | null>(null);
  const [ownerMismatch, setOwnerMismatch] = useState<{ ownerProfileId: string } | null>(null);
  const engineRef = useRef<PaginationEngine | null>(null);
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pageCount = useScriptForgeStore((s) => s.pageCount);
  const setPageCount = useScriptForgeStore((s) => s.setPageCount);
  const setWordCount = useScriptForgeStore((s) => s.setWordCount);
  const currentElementType = useScriptForgeStore((s) => s.currentElementType);
  const setCurrentElementType = useScriptForgeStore((s) => s.setCurrentElementType);
  const setCurrentScriptId = useScriptForgeStore((s) => s.setCurrentScriptId);
  const setScriptTitle = useScriptForgeStore((s) => s.setScriptTitle);
  const setTitleBlock = useScriptForgeStore((s) => s.setTitleBlock);
  const setScriptMeta = useScriptForgeStore((s) => s.setScriptMeta);
  const setSaveState = useScriptForgeStore((s) => s.setSaveState);
  const setSavedSlotLabel = useScriptForgeStore((s) => s.setSavedSlotLabel);
  const setRequestSave = useScriptForgeStore((s) => s.setRequestSave);
  const activeProfile = useScriptForgeStore((s) => s.activeProfile);
  const setActiveProfile = useScriptForgeStore((s) => s.setActiveProfile);
  const profiles = useScriptForgeStore((s) => s.profiles);

  // Stable refs so Tiptap callbacks always see current values.
  const scriptIdRef = useRef(scriptId);
  const setSaveStateRef = useRef(setSaveState);
  const setSavedSlotLabelRef = useRef(setSavedSlotLabel);
  scriptIdRef.current = scriptId;
  setSaveStateRef.current = setSaveState;
  setSavedSlotLabelRef.current = setSavedSlotLabel;

  const editor = useEditor({
    extensions: [
      CustomDocument,
      StarterKit.configure({ document: false }),
      PageNode,
      SceneHeading,
      Action,
      Character,
      Dialogue,
      Parenthetical,
      Transition,
      ScreenplayBehaviors,
      Placeholder.configure({
        showOnlyCurrent: false,
        placeholder: ({ node }) => PLACEHOLDERS[node.type.name] ?? "",
      }),
    ],
    content: INITIAL_CONTENT,
    immediatelyRender: false,

    onCreate({ editor }) {
      const eng = new PaginationEngine();
      eng.setEditor(editor);
      engineRef.current = eng;
      setEngine(eng);
      setPageCount(1);
    },

    onDestroy() {
      engineRef.current?.destroy();
      engineRef.current = null;
    },

    onUpdate({ editor, transaction }) {
      let count = 0;
      editor.state.doc.forEach((node) => {
        if (node.type.name === "page") count++;
      });
      setPageCount(count);
      const words = editor.getText().split(/\s+/).filter(Boolean).length;
      setWordCount(words);
      setSuggestState(getSuggestState(editor));
      const updatedTypeName = editor.state.selection.$anchor.parent.type.name;
      setCurrentElementType(isElementType(updatedTypeName) ? updatedTypeName : null);

      if (transaction.getMeta("pagination")) return;

      const currentId = scriptIdRef.current;
      if (!currentId) return;

      setSaveStateRef.current("unsaved");

      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = setTimeout(async () => {
        const { titleBlock } = useScriptForgeStore.getState();
        const fountain = tiptapToFountain(editor.state.doc.toJSON(), titleBlock);
        setSaveStateRef.current("saving");
        try {
          const res = await fetch(`/api/scripts/${currentId}?autosave=true`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ fountain }),
          });
          if (res.ok) {
            const data = (await res.json()) as { autosaveSnapshot?: { slot: number } | null };
            if (data.autosaveSnapshot) {
              setSavedSlotLabelRef.current(`Slot ${data.autosaveSnapshot.slot}`);
              setTimeout(() => setSavedSlotLabelRef.current(null), 2000);
            }
            setSaveStateRef.current("saved");
          } else {
            console.error("autosave failed", res.status);
            setSaveStateRef.current("error");
          }
        } catch (err) {
          console.error("autosave error", err);
          setSaveStateRef.current("error");
        }
      }, 1500);
    },

    onSelectionUpdate({ editor }) {
      const { $anchor } = editor.state.selection;

      const typeName = $anchor.parent.type.name;
      setCurrentElementType(isElementType(typeName) ? typeName : null);

      let page = 1;
      editor.state.doc.forEach((node, offset) => {
        if (node.type.name !== "page") return;
        if ($anchor.pos > offset + node.nodeSize) page++;
      });
      setActivePage(page);

      setSuggestState(getSuggestState(editor));
    },
  });

  // Load script content whenever the editor is ready and scriptId changes.
  useEffect(() => {
    if (!editor || !scriptId) return;

    let cancelled = false;
    setSaveState("loading");
    setLoadError(null);

    fetch(`/api/scripts/${scriptId}`)
      .then(async (res) => {
        if (cancelled) return;
        if (res.status === 404) { setLoadError("not_found"); return; }
        if (!res.ok) { setLoadError("failed"); return; }

        const data = (await res.json()) as {
          scriptId: string;
          title: string;
          fountain: string;
          ownerProfileId?: string;
        };
        if (cancelled) return;

        // Ownership guard
        const { activeProfile: profile } = useScriptForgeStore.getState();
        if (data.ownerProfileId && profile && data.ownerProfileId !== profile.profileId) {
          setOwnerMismatch({ ownerProfileId: data.ownerProfileId });
          setSaveState("readonly");
          return;
        }

        const fountain = data.fountain ?? "";
        const tb = parseTitleBlock(fountain);
        setCurrentScriptId(data.scriptId);
        setScriptTitle(data.title || tb?.title || "Untitled");
        setTitleBlock(tb);
        if (tb) {
          setScriptMeta({
            title: tb.title ?? "",
            author: tb.author ?? "",
            contact: tb.contact ?? "",
            draftLabel: tb.draft ?? "",
          });
        }
        editor.commands.setContent(fountainToTiptap(fountain));
        setSaveState("saved");
      })
      .catch(() => {
        if (!cancelled) setLoadError("failed");
      });

    return () => { cancelled = true; };
  }, [editor, scriptId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cancel pending autosave on unmount.
  useEffect(() => {
    return () => {
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    };
  }, []);

  // Register an immediate-save callback in the store so EditorHeader can trigger it.
  useEffect(() => {
    if (!editor) return;
    const save = async () => {
      const { titleBlock, currentScriptId, setSaveState: setSS } = useScriptForgeStore.getState();
      if (!currentScriptId) return;
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = null;
      }
      const fountain = tiptapToFountain(editor.state.doc.toJSON(), titleBlock);
      setSS("saving");
      const res = await fetch(`/api/scripts/${currentScriptId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fountain }),
      });
      if (res.ok) {
        setSS("saved");
      } else {
        setSS("error");
        throw new Error("Save failed");
      }
    };
    setRequestSave(save);
    return () => { setRequestSave(null); };
  }, [editor, setRequestSave]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSuggestInsert = (text: string) => {
    if (!editor) return;
    editor.commands.insertContent(text);
    setSuggestState(null);
  };

  if (ownerMismatch) {
    const ownerProfile = profiles.find((p) => p.profileId === ownerMismatch.ownerProfileId);
    return (
      <div className="h-screen flex flex-col items-center justify-center gap-6 bg-[#0f0f14]">
        <div className="max-w-sm w-full mx-4 px-8 py-8 rounded-xl text-center"
          style={{ background: "#13131a", border: "1px solid #2a2a35" }}>
          <p className="text-white text-[17px] font-bold font-sans mb-2">
            Wrong profile
          </p>
          <p className="text-[13px] font-sans mb-6" style={{ color: "#6b6b76" }}>
            This script belongs to{" "}
            <span style={{ color: "#c8cdd8" }}>
              {ownerProfile?.name ?? "a different profile"}
            </span>
            .
          </p>
          <div className="flex flex-col gap-2">
            {ownerProfile && (
              <button
                onClick={() => {
                  setActiveProfile(ownerProfile);
                  window.location.reload();
                }}
                className="w-full py-2 rounded-lg text-[14px] font-semibold font-sans text-white"
                style={{ background: "#6366f1" }}
              >
                Switch to {ownerProfile.name}
              </button>
            )}
            <button
              onClick={() => { setActiveProfile(null); router.push("/"); }}
              className="w-full py-2 rounded-lg text-[14px] font-sans"
              style={{ background: "#1e1e28", color: "#9099a8" }}
            >
              Back to home
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <LoadError
        kind={loadError}
        onRetry={() => {
          setLoadError(null);
          // Re-trigger by flipping a key — simplest: just reload the page segment.
          window.location.reload();
        }}
      />
    );
  }

  return (
    <PaginationEngineContext.Provider value={engine}>
      <div className="h-screen flex flex-col bg-[var(--color-canvas)]">
        <EditorHeader />
        <EditorToolbar editor={editor} />
        <div className="flex-1 overflow-y-auto py-10">
          <EditorContent editor={editor} />
        </div>
      </div>

      {editor && (
        <SuggestPopup
          editor={editor}
          state={suggestState}
          onInsert={handleSuggestInsert}
          onDismiss={() => setSuggestState(null)}
        />
      )}

      {currentElementType && (
        <div className="fixed bottom-4 left-4 text-indigo-400 text-xs font-sans pointer-events-none select-none">
          {ELEMENT_DISPLAY_NAMES[currentElementType]}
        </div>
      )}

      <div className="fixed bottom-4 right-4 text-indigo-400 text-xs font-mono pointer-events-none select-none">
        {activePage} / {pageCount}
      </div>
    </PaginationEngineContext.Provider>
  );
}

function LoadError({
  kind,
  onRetry,
}: {
  kind: "not_found" | "failed";
  onRetry: () => void;
}) {
  const router = useRouter();

  return (
    <div className="h-screen flex flex-col items-center justify-center gap-4 bg-[#0f0f14]">
      <p className="text-[var(--color-fg-secondary)] text-[15px] font-sans">
        {kind === "not_found" ? "Script not found" : "Failed to load script"}
      </p>
      <div className="flex items-center gap-4">
        {kind === "failed" && (
          <button
            onClick={onRetry}
            className="text-indigo-400 hover:text-indigo-300 text-[14px] font-sans transition-colors"
          >
            Retry
          </button>
        )}
        <button
          onClick={() => router.push("/")}
          className="text-[var(--color-fg-secondary)] hover:text-indigo-400 text-[14px] font-sans transition-colors"
        >
          ← Back to library
        </button>
      </div>
    </div>
  );
}
