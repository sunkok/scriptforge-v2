"use client";

import { use, useEffect, useRef, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import Document from "@tiptap/extension-document";
import StarterKit from "@tiptap/starter-kit";
import { Eye } from "lucide-react";
import { PageNode } from "@/components/editor/PageNode";
import { PaginationEngineContext } from "@/components/editor/PaginationContext";
import {
  SceneHeading,
  Action,
  Character,
  Dialogue,
  Parenthetical,
  Transition,
} from "@/lib/editor/nodes";
import { PaginationEngine } from "@/lib/pagination/engine";
import { fountainToTiptap } from "@/lib/fountain/parser";

const CustomDocument = Document.extend({ content: "page+" });

// ─── types ────────────────────────────────────────────────────────────────────

type ShareData = {
  fountain: string;
  scriptTitle: string;
  versionLabel: string;
  scriptId: string;
  versionId: string;
};

type ErrorState = { status: number; message: string };

// ─── read-only editor ─────────────────────────────────────────────────────────

function ReadOnlyViewer({ fountain }: { fountain: string }) {
  const engineRef = useRef<PaginationEngine | null>(null);
  const [engine, setEngine] = useState<PaginationEngine | null>(null);

  const doc = fountainToTiptap(fountain);

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
    ],
    content: doc,
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

  return (
    <PaginationEngineContext.Provider value={engine}>
      {/* cursor:text lets reviewers select/copy text */}
      <div style={{ cursor: "text" }}>
        <EditorContent editor={editor} />
      </div>
    </PaginationEngineContext.Provider>
  );
}

// ─── page ─────────────────────────────────────────────────────────────────────

export default function SharePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ShareData | null>(null);
  const [error, setError] = useState<ErrorState | null>(null);

  useEffect(() => {
    fetch(`/api/shares/${token}`)
      .then(async (res) => {
        const body = await res.json() as {
          fountain?: string;
          scriptTitle?: string;
          versionLabel?: string;
          scriptId?: string;
          versionId?: string;
          error?: string;
        };
        if (!res.ok) {
          setError({ status: res.status, message: body.error ?? "Failed to load" });
        } else {
          setData({
            fountain: body.fountain!,
            scriptTitle: body.scriptTitle!,
            versionLabel: body.versionLabel!,
            scriptId: body.scriptId!,
            versionId: body.versionId!,
          });
        }
      })
      .catch(() => setError({ status: 500, message: "Failed to load shared script" }))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#0f0f14]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-[#2a2a35] border-t-indigo-400" />
          <p className="text-[13px] text-[var(--color-fg-secondary)] font-sans">
            Loading shared script…
          </p>
        </div>
      </main>
    );
  }

  if (error) {
    const heading =
      error.status === 404 ? "Share link not found." :
      error.status === 410 ? "This link is no longer available." :
      "Something went wrong.";
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#0f0f14]">
        <div
          className="max-w-sm w-full mx-4 px-8 py-10 text-center rounded-xl"
          style={{ background: "#13131a", border: "1px solid #2a2a35" }}
        >
          <p className="text-white text-[17px] font-bold font-sans">{heading}</p>
          <p className="mt-2 text-[13px] text-[#6b6b76] font-sans">{error.message}</p>
        </div>
      </main>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-[#0f0f14]">
      {/* Header */}
      <header className="flex items-center justify-between px-5 shrink-0 h-14 bg-[#0b0d11] border-b border-[var(--color-border-subtle)]">
        <div className="flex items-center gap-3 min-w-0">
          {/* Branding mark */}
          <span
            className="shrink-0 text-[11px] font-bold font-sans px-1.5 py-0.5 rounded"
            style={{ background: "#6366f1", color: "white", letterSpacing: "0.04em" }}
          >
            SF
          </span>
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-white font-bold text-[16px] font-sans truncate">
              {data!.scriptTitle}
            </span>
            <span className="text-[var(--color-fg-secondary)] text-[14px] font-sans shrink-0">
              — {data!.versionLabel}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0 text-[12px] font-sans text-[#6b6b76]">
          <Eye size={13} />
          <span>Read-only view</span>
        </div>
      </header>

      {/* Script canvas */}
      <main className="flex-1 overflow-y-auto py-10">
        <ReadOnlyViewer fountain={data!.fountain} />
      </main>
    </div>
  );
}
