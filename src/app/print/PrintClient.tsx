"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useEditor, EditorContent } from "@tiptap/react";
import Document from "@tiptap/extension-document";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Placeholder from "@tiptap/extension-placeholder";
import { PageNode } from "@/components/editor/PageNode";
import {
  SceneHeading,
  Action,
  Character,
  Dialogue,
  Parenthetical,
  Transition,
} from "@/lib/editor/nodes";
import { PaginationEngine } from "@/lib/pagination/engine";
import { PaginationEngineContext } from "@/components/editor/PaginationContext";
import { useScriptForgeStore } from "@/lib/store";
import { fountainToTiptap } from "@/lib/fountain/parser";
import { parseTitleBlock } from "@/lib/fountain/title-block";
import type { ScriptTitleBlock } from "@/lib/types";

const CustomDocument = Document.extend({ content: "page+" });

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDateForPrint(dateStr?: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

// ─── Title page sub-component ─────────────────────────────────────────────────

interface TitlePageProps {
  titleBlock: ScriptTitleBlock;
  scriptTitle: string;
}

function TitlePage({ titleBlock, scriptTitle }: TitlePageProps) {
  const displayTitle = titleBlock.title || scriptTitle;
  const draftLine = [
    titleBlock.draft,
    formatDateForPrint(titleBlock.date),
  ]
    .filter(Boolean)
    .join(" - ");

  return (
    <div
      className="page-sheet print-title-page"
      style={{ display: "flex", flexDirection: "column" }}
    >
      {/* Upper spacer */}
      <div style={{ flex: 2 }} />

      {/* Center block */}
      <div
        style={{
          textAlign: "center",
          fontFamily: "var(--font-courier-prime), 'Courier New', monospace",
          fontSize: "12pt",
          color: "#000",
        }}
      >
        {displayTitle && (
          <p
            style={{
              fontSize: "14pt",
              fontWeight: "bold",
              textTransform: "uppercase",
              margin: "0 0 1em",
            }}
          >
            {displayTitle}
          </p>
        )}
        {titleBlock.author && (
          <>
            <p style={{ margin: "0 0 0.25em" }}>Written by</p>
            <p style={{ margin: 0 }}>{titleBlock.author}</p>
          </>
        )}
      </div>

      {/* Lower spacer */}
      <div style={{ flex: 3 }} />

      {/* Footer row */}
      {(draftLine || titleBlock.source || titleBlock.contact) && (
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "flex-end",
            fontFamily: "var(--font-courier-prime), 'Courier New', monospace",
            fontSize: "11pt",
            color: "#000",
          }}
        >
          <div>
            {draftLine && <p style={{ margin: "0 0 0.25em" }}>{draftLine}</p>}
            {titleBlock.source && (
              <p style={{ margin: 0, fontStyle: "italic" }}>{titleBlock.source}</p>
            )}
          </div>
          {titleBlock.contact && (
            <div style={{ textAlign: "right", whiteSpace: "pre-line" }}>
              {titleBlock.contact}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main PrintClient ─────────────────────────────────────────────────────────

type LoadPhase = "loading" | "ready" | "error";
type PrintPhase = "waiting" | "printing" | "done";

export default function PrintClient() {
  const searchParams = useSearchParams();
  const scriptId = searchParams.get("id");

  const [engine, setEngine] = useState<PaginationEngine | null>(null);
  const [loadPhase, setLoadPhase] = useState<LoadPhase>("loading");
  const [printPhase, setPrintPhase] = useState<PrintPhase>("waiting");
  const [titleBlock, setTitleBlock] = useState<ScriptTitleBlock | undefined>(undefined);
  const [scriptTitle, setScriptTitle] = useState<string>("");

  const engineRef = useRef<PaginationEngine | null>(null);
  const hasTitlePageChecked =
    loadPhase === "ready" &&
    titleBlock != null &&
    (!!titleBlock.title || !!titleBlock.author);

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
      Underline,
      Placeholder.configure({ showOnlyCurrent: false, placeholder: () => "" }),
    ],
    content: {
      type: "doc",
      content: [{ type: "page", content: [{ type: "scene_heading" }] }],
    },
    editable: false,
    immediatelyRender: false,

    onCreate({ editor: ed }) {
      const eng = new PaginationEngine();
      eng.setEditor(ed);
      engineRef.current = eng;
      setEngine(eng);
    },

    onDestroy() {
      engineRef.current?.destroy();
      engineRef.current = null;
    },
  });

  // ─── Script fetch ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!editor || !scriptId) return;
    let cancelled = false;

    fetch(`/api/scripts/${scriptId}`)
      .then(async (res) => {
        if (cancelled) return;
        if (res.status === 404 || !res.ok) {
          setLoadPhase("error");
          return;
        }
        const data = (await res.json()) as {
          scriptId: string;
          title: string;
          fountain?: string;
          titleBlock?: ScriptTitleBlock;
        };
        if (cancelled) return;

        const fountain = data.fountain ?? "";
        const tb: ScriptTitleBlock | undefined =
          data.titleBlock ?? parseTitleBlock(fountain);

        setTitleBlock(tb);
        setScriptTitle(data.title || tb?.title || "Untitled");
        editor.commands.setContent(fountainToTiptap(fountain));
        setLoadPhase("ready");
      })
      .catch(() => {
        if (!cancelled) setLoadPhase("error");
      });

    return () => { cancelled = true; };
  }, [editor, scriptId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Pagination watcher ───────────────────────────────────────────────────
  useEffect(() => {
    if (loadPhase !== "ready") return;

    let hasSeen = false;
    const safetyTimer = setTimeout(() => {
      setPrintPhase("printing");
    }, 4000);

    const unsub = useScriptForgeStore.subscribe((state) => {
      if (state.paginationStatus === "reconciling") {
        hasSeen = true;
      }
      if (hasSeen && state.paginationStatus === "idle") {
        unsub();
        clearTimeout(safetyTimer);
        setTimeout(() => {
          setPrintPhase("printing");
        }, 400);
      }
    });

    return () => {
      unsub();
      clearTimeout(safetyTimer);
    };
  }, [loadPhase]);

  // ─── Page number injection helper ────────────────────────────────────────
  function injectPageNumbers() {
    const sheets = document.querySelectorAll<HTMLElement>(".page-sheet");
    sheets.forEach((sheet, index) => {
      // Remove any previously injected page numbers
      sheet.querySelectorAll(".print-page-number").forEach((el) => el.remove());
      sheet.style.position = "relative";
      if (index > 0) {
        const numDiv = document.createElement("div");
        numDiv.className = "print-page-number";
        numDiv.textContent = `${index + 1}.`;
        numDiv.style.cssText = [
          "position: absolute",
          "top: 0.5in",
          "right: 1in",
          `font-family: var(--font-courier-prime), 'Courier New', monospace`,
          "font-size: 12pt",
          "color: black",
          "pointer-events: none",
        ].join("; ");
        sheet.appendChild(numDiv);
      }
    });
  }

  // ─── Print trigger ────────────────────────────────────────────────────────
  useEffect(() => {
    if (printPhase !== "printing") return;

    injectPageNumbers();

    const timer = setTimeout(() => {
      window.print();
      setPrintPhase("done");
    }, 100);

    return () => clearTimeout(timer);
  }, [printPhase]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Error state ──────────────────────────────────────────────────────────
  if (loadPhase === "error") {
    return (
      <div
        style={{
          padding: "2rem",
          fontFamily: "sans-serif",
          background: "white",
          minHeight: "100vh",
        }}
      >
        <p>Script not found or could not be loaded.</p>
        <button onClick={() => window.close()}>Close</button>
      </div>
    );
  }

  // ─── Main render ──────────────────────────────────────────────────────────
  return (
    <div className="print-view" style={{ background: "white", minHeight: "100vh" }}>
      {/* Screen-only control bar */}
      <div
        className="no-print"
        style={{
          background: "#0f0f14",
          padding: "12px 20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span
          style={{
            color: "#9099a8",
            fontFamily: "var(--font-inter), system-ui, sans-serif",
            fontSize: "13px",
          }}
        >
          {printPhase === "waiting"
            ? "Preparing print preview…"
            : printPhase === "printing"
            ? "Opening print dialog…"
            : scriptTitle}
        </span>
        <div style={{ display: "flex", gap: "8px" }}>
          <button
            onClick={() => {
              injectPageNumbers();
              window.print();
            }}
            style={{
              background: "#1e1e28",
              color: "#9099a8",
              border: "1px solid #2a2a35",
              borderRadius: "6px",
              padding: "6px 14px",
              fontSize: "13px",
              fontFamily: "var(--font-inter), system-ui, sans-serif",
              cursor: "pointer",
            }}
          >
            Print again
          </button>
          <button
            onClick={() => window.close()}
            style={{
              background: "#1e1e28",
              color: "#9099a8",
              border: "1px solid #2a2a35",
              borderRadius: "6px",
              padding: "6px 14px",
              fontSize: "13px",
              fontFamily: "var(--font-inter), system-ui, sans-serif",
              cursor: "pointer",
            }}
          >
            Close
          </button>
        </div>
      </div>

      {/* Title page */}
      {hasTitlePageChecked && titleBlock && (
        <TitlePage titleBlock={titleBlock} scriptTitle={scriptTitle} />
      )}

      {/* Script pages */}
      <PaginationEngineContext.Provider value={engine}>
        <EditorContent editor={editor} />
      </PaginationEngineContext.Provider>
    </div>
  );
}
