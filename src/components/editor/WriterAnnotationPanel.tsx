"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import Document from "@tiptap/extension-document";
import StarterKit from "@tiptap/starter-kit";
import { X } from "lucide-react";
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
import { AnnotationDecorations } from "@/lib/editor/annotation-decorations";
import { PaginationEngine } from "@/lib/pagination/engine";
import { fountainToTiptap } from "@/lib/fountain/parser";
import { relativeTime } from "@/lib/relative-time";
import type { Annotation } from "@/lib/types";

const CustomDocument = Document.extend({ content: "page+" });
const WRITER_NAME_KEY = "writer-name";

// ─── writer name modal ────────────────────────────────────────────────────────

function WriterNameModal({ onConfirm }: { onConfirm: (name: string) => void }) {
  const [name, setName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const submit = () => {
    const t = name.trim();
    if (t) onConfirm(t);
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60">
      <div
        className="max-w-sm w-full mx-4 px-8 py-8 rounded-xl"
        style={{ background: "#13131a", border: "1px solid #2a2a35" }}
      >
        <p className="text-white text-[17px] font-bold font-sans mb-1">
          What&apos;s your name?
        </p>
        <p className="mb-5 text-[13px] font-sans" style={{ color: "#6b6b76" }}>
          Used to identify your replies.
        </p>
        <input
          ref={inputRef}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="Your name (e.g. Sun)"
          className="w-full px-3 py-2 rounded-lg text-[14px] font-sans text-white focus:outline-none mb-4"
          style={{ background: "#0f0f14", border: "1px solid #2a2a35" }}
        />
        <button
          onClick={submit}
          disabled={!name.trim()}
          className="w-full py-2 rounded-lg text-[14px] font-semibold font-sans text-white disabled:opacity-40"
          style={{ background: "#6366f1" }}
        >
          Continue
        </button>
      </div>
    </div>
  );
}

// ─── annotation card ──────────────────────────────────────────────────────────

function AnnotationCard({
  ann,
  scriptId,
  versionId,
  isReply,
  isPulsing,
  onRefresh,
  onScrollToHighlight,
  onReply,
}: {
  ann: Annotation;
  scriptId: string;
  versionId: string;
  isReply: boolean;
  isPulsing: boolean;
  onRefresh: () => Promise<void>;
  onScrollToHighlight: (id: string) => void;
  onReply?: () => void;
}) {
  const [editMode, setEditMode] = useState(false);
  const [editBody, setEditBody] = useState(ann.body);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { setEditBody(ann.body); }, [ann.body]);

  const patch = async (updates: Record<string, string | null>): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/scripts/${scriptId}/versions/${versionId}/annotations/${ann.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updates),
        }
      );
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setError(data.error ?? "Failed to update");
        setTimeout(() => setError(null), 3000);
        return false;
      }
      await onRefresh();
      return true;
    } catch {
      setError("Network error");
      setTimeout(() => setError(null), 3000);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const saveEdit = async () => {
    const ok = await patch({ body: editBody.trim() });
    if (ok) setEditMode(false);
  };

  const toggleResolve = () =>
    void patch({
      resolvedAt: ann.resolvedAt ? null : new Date().toISOString(),
    });

  const confirmDelete = async () => {
    setLoading(true);
    try {
      await fetch(
        `/api/scripts/${scriptId}/versions/${versionId}/annotations/${ann.id}`,
        { method: "DELETE" }
      );
      await onRefresh();
    } catch {
      setError("Network error");
      setTimeout(() => setError(null), 3000);
      setLoading(false);
    }
  };

  const snippet =
    ann.anchorQuote.length > 80
      ? ann.anchorQuote.slice(0, 80) + "…"
      : ann.anchorQuote;

  return (
    <div
      style={{
        background: isPulsing ? "rgba(99,102,241,0.1)" : "#1a1a24",
        border: `1px solid ${isPulsing ? "rgba(99,102,241,0.35)" : "#2a2a35"}`,
        borderRadius: 8,
        padding: "12px 14px",
        marginLeft: isReply ? 16 : 0,
        borderLeft: isReply ? "2px solid #3a3a5a" : undefined,
        transition: "background 0.5s ease, border-color 0.5s ease",
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
        <span className="text-[13px] font-bold font-sans text-white">
          {ann.authorName}
        </span>
        <span
          className="text-[10px] font-sans px-1.5 py-0.5 rounded"
          style={{
            background: ann.authorRole === "writer" ? "#1e293b" : "#1e1b2e",
            color: ann.authorRole === "writer" ? "#94a3b8" : "#a5b4fc",
          }}
        >
          {ann.authorRole === "writer" ? "Writer" : "Reviewer"}
        </span>
        {ann.resolvedAt && (
          <span
            className="text-[10px] font-sans px-1.5 py-0.5 rounded"
            style={{ background: "#14532d", color: "#86efac" }}
          >
            Resolved
          </span>
        )}
      </div>

      {/* Quoted snippet — top-level only, clickable to jump to highlight */}
      {!isReply && snippet && (
        <p
          className="text-[11px] font-sans italic mb-2 leading-snug cursor-pointer hover:text-indigo-300 transition-colors"
          style={{ color: "#5a6070" }}
          onClick={() => onScrollToHighlight(ann.id)}
        >
          &ldquo;{snippet}&rdquo;
        </p>
      )}

      {/* Body / edit textarea */}
      {editMode ? (
        <textarea
          value={editBody}
          onChange={(e) => setEditBody(e.target.value)}
          rows={3}
          autoFocus
          className="w-full px-3 py-2 rounded-lg text-[13px] font-sans text-white focus:outline-none resize-none mb-2"
          style={{
            background: "#0a0a10",
            border: "1px solid #2a2a35",
            minHeight: 72,
          }}
        />
      ) : (
        <p
          className="text-[13px] font-sans leading-snug mb-1.5"
          style={{ color: "#c8cdd8" }}
        >
          {ann.body}
        </p>
      )}

      {/* Timestamp */}
      <p className="text-[11px] font-sans mb-2.5" style={{ color: "#4a5060" }}>
        {relativeTime(ann.createdAt)}
      </p>

      {error && (
        <p className="text-[12px] font-sans mb-2" style={{ color: "#f87171" }}>
          {error}
        </p>
      )}

      {/* Action area */}
      {deleteConfirm ? (
        <div>
          <p className="text-[12px] font-sans mb-2" style={{ color: "#d1d5db" }}>
            Delete this comment?{!isReply && " Replies will also be removed."}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => void confirmDelete()}
              disabled={loading}
              className="flex-1 py-1.5 rounded-lg text-[12px] font-sans font-semibold text-white disabled:opacity-40"
              style={{ background: "#ef4444" }}
            >
              {loading ? "Deleting…" : "Delete"}
            </button>
            <button
              onClick={() => setDeleteConfirm(false)}
              className="flex-1 py-1.5 rounded-lg text-[12px] font-sans"
              style={{ background: "#242434", color: "#9099a8" }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : editMode ? (
        <div className="flex gap-2">
          <button
            onClick={() => void saveEdit()}
            disabled={!editBody.trim() || loading}
            className="flex-1 py-1.5 rounded-lg text-[12px] font-sans font-semibold text-white disabled:opacity-40"
            style={{ background: "#6366f1" }}
          >
            {loading ? "Saving…" : "Save"}
          </button>
          <button
            onClick={() => { setEditMode(false); setEditBody(ann.body); }}
            className="flex-1 py-1.5 rounded-lg text-[12px] font-sans"
            style={{ background: "#242434", color: "#9099a8" }}
          >
            Cancel
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {!isReply && onReply && (
            <button
              onClick={onReply}
              className="text-[12px] font-sans px-2.5 py-1 rounded"
              style={{ background: "#242434", color: "#9099a8" }}
            >
              Reply
            </button>
          )}
          {!isReply && (
            <button
              onClick={toggleResolve}
              disabled={loading}
              className="text-[12px] font-sans px-2.5 py-1 rounded disabled:opacity-40"
              style={{ background: "#242434", color: "#9099a8" }}
            >
              {ann.resolvedAt ? "Mark unresolved" : "Mark resolved"}
            </button>
          )}
          <button
            onClick={() => setEditMode(true)}
            className="text-[12px] font-sans px-2.5 py-1 rounded"
            style={{ background: "#242434", color: "#9099a8" }}
          >
            Edit
          </button>
          <button
            onClick={() => setDeleteConfirm(true)}
            className="text-[12px] font-sans px-2.5 py-1 rounded"
            style={{ background: "#242434", color: "#f87171" }}
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

// ─── reply composer ───────────────────────────────────────────────────────────

function ReplyComposer({
  parent,
  scriptId,
  versionId,
  writerName,
  onSubmit,
  onCancel,
}: {
  parent: Annotation;
  scriptId: string;
  versionId: string;
  writerName: string;
  onSubmit: () => Promise<void>;
  onCancel: () => void;
}) {
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { textareaRef.current?.focus(); }, []);

  const submit = async () => {
    const t = body.trim();
    if (!t || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/scripts/${scriptId}/versions/${versionId}/annotations`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            authorName: writerName,
            anchorStart: parent.anchorStart,
            anchorEnd: parent.anchorEnd,
            anchorQuote: parent.anchorQuote,
            body: t,
            parentId: parent.id,
          }),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        setError((data as { error?: string }).error ?? "Failed to submit");
        setTimeout(() => setError(null), 3000);
        return;
      }
      await onSubmit();
    } catch {
      setError("Network error");
      setTimeout(() => setError(null), 3000);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="mt-2"
      style={{
        marginLeft: 16,
        paddingLeft: 12,
        borderLeft: "2px solid #3a3a5a",
      }}
    >
      <p className="text-[11px] font-sans mb-1.5" style={{ color: "#6b6b76" }}>
        Replying as{" "}
        <span style={{ color: "#9099a8" }}>{writerName}</span>
      </p>
      <textarea
        ref={textareaRef}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Write a reply…"
        rows={2}
        className="w-full px-3 py-2 rounded-lg text-[13px] font-sans text-white focus:outline-none resize-none"
        style={{
          background: "#0a0a10",
          border: "1px solid #2a2a35",
          minHeight: 60,
        }}
      />
      {error && (
        <p className="text-[12px] font-sans mt-1" style={{ color: "#f87171" }}>
          {error}
        </p>
      )}
      <div className="flex items-center justify-end gap-2 mt-2">
        <button
          onClick={onCancel}
          className="text-[13px] font-sans px-3 py-1 rounded-lg"
          style={{ color: "#6b6b76" }}
        >
          Cancel
        </button>
        <button
          onClick={() => void submit()}
          disabled={!body.trim() || loading}
          className="text-[13px] font-sans px-4 py-1.5 rounded-lg font-semibold text-white disabled:opacity-40"
          style={{ background: "#6366f1" }}
        >
          {loading ? "Sending…" : "Send"}
        </button>
      </div>
    </div>
  );
}

// ─── main panel ───────────────────────────────────────────────────────────────

export default function WriterAnnotationPanel({
  scriptId,
  versionId,
  versionLabel,
  onClose,
}: {
  scriptId: string;
  versionId: string;
  versionLabel: string;
  onClose: () => void;
}) {
  const [fountain, setFountain] = useState<string | null>(null);
  const [fountainLoading, setFountainLoading] = useState(true);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [writerName, setWriterName] = useState<string | null>(null);
  const [nameModalOpen, setNameModalOpen] = useState(false);
  const nameCallbackRef = useRef<(() => void) | null>(null);
  const [pulseCardId, setPulseCardId] = useState<string | null>(null);
  const [replyOpenId, setReplyOpenId] = useState<string | null>(null);
  const engineRef = useRef<PaginationEngine | null>(null);
  const [engine, setEngine] = useState<PaginationEngine | null>(null);
  const cardRefs = useRef<Map<string, HTMLElement>>(new Map());

  useEffect(() => {
    const stored = localStorage.getItem(WRITER_NAME_KEY);
    if (stored) setWriterName(stored);
  }, []);

  useEffect(() => {
    setFountainLoading(true);
    fetch(`/api/scripts/${scriptId}/versions/${versionId}`)
      .then(async (r) => {
        if (!r.ok) return;
        const data = (await r.json()) as { fountain?: string };
        if (data.fountain) setFountain(data.fountain);
      })
      .catch(() => {})
      .finally(() => setFountainLoading(false));
  }, [scriptId, versionId]);

  const refreshAnnotations = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/scripts/${scriptId}/versions/${versionId}/annotations`
      );
      if (!res.ok) return;
      const data = (await res.json()) as { annotations?: Annotation[] };
      setAnnotations(data.annotations ?? []);
    } catch {
      // silently ignore
    }
  }, [scriptId, versionId]);

  useEffect(() => {
    void refreshAnnotations();
  }, [refreshAnnotations]);

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
      AnnotationDecorations,
    ],
    content: null,
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

  // Set content once fountain is loaded
  useEffect(() => {
    if (editor && fountain) {
      editor.commands.setContent(fountainToTiptap(fountain));
    }
  }, [editor, fountain]);

  // Push annotations into decoration plugin
  useEffect(() => {
    if (editor) editor.commands.setAnnotations(annotations);
  }, [editor, annotations]);

  // Click on highlight in left pane → scroll to card + pulse it
  useEffect(() => {
    if (!editor) return;
    const dom = editor.view.dom;
    const handleClick = (e: MouseEvent) => {
      const target =
        e.target instanceof Element
          ? e.target.closest(".annotation-highlight")
          : null;
      if (!target) return;
      const id = target.getAttribute("data-annotation-id");
      if (!id) return;
      e.stopPropagation();

      const cardEl = cardRefs.current.get(id);
      if (cardEl) cardEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
      setPulseCardId(id);
      setTimeout(() => setPulseCardId(null), 1000);
    };
    dom.addEventListener("click", handleClick);
    return () => dom.removeEventListener("click", handleClick);
  }, [editor]);

  const scrollToHighlight = useCallback(
    (annotationId: string) => {
      if (!editor) return;
      const el = editor.view.dom.querySelector(
        `[data-annotation-id="${annotationId}"]`
      );
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("pulse");
      setTimeout(() => el.classList.remove("pulse"), 1000);
    },
    [editor]
  );

  const requestName = (callback: () => void) => {
    if (writerName) { callback(); return; }
    nameCallbackRef.current = callback;
    setNameModalOpen(true);
  };

  const handleNameConfirm = (name: string) => {
    localStorage.setItem(WRITER_NAME_KEY, name);
    setWriterName(name);
    setNameModalOpen(false);
    nameCallbackRef.current?.();
    nameCallbackRef.current = null;
  };

  // Keyboard close
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Top-level annotations sorted newest-first; replies grouped under parent oldest-first
  const topLevel = useMemo(
    () =>
      annotations
        .filter((a) => a.parentId === null)
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        ),
    [annotations]
  );

  const repliesByParent = useMemo(() => {
    const map = new Map<string, Annotation[]>();
    for (const a of annotations) {
      if (a.parentId === null) continue;
      if (!map.has(a.parentId)) map.set(a.parentId, []);
      map.get(a.parentId)!.push(a);
    }
    for (const replies of map.values()) {
      replies.sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
    }
    return map;
  }, [annotations]);

  return (
    <div className="fixed inset-0 z-[70] flex flex-col" style={{ background: "#0f0f14" }}>
      {/* Header */}
      <div
        className="flex items-center justify-between px-6 shrink-0 h-14"
        style={{ background: "#0b0d11", borderBottom: "1px solid #2a2a35" }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-white font-bold text-[16px] font-sans truncate">
            Comments on {versionLabel}
          </span>
          {topLevel.length > 0 && (
            <span
              className="shrink-0 text-[11px] font-sans px-2 py-0.5 rounded-full"
              style={{ background: "#1e1b2e", color: "#a5b4fc" }}
            >
              {topLevel.length}
            </span>
          )}
        </div>

        <div className="flex items-center gap-4 shrink-0">
          {writerName && (
            <div
              className="flex items-center gap-1.5 text-[12px] font-sans"
              style={{ color: "#6b6b76" }}
            >
              <span>
                Replying as:{" "}
                <span style={{ color: "#9099a8" }}>{writerName}</span>
              </span>
              <button
                onClick={() => {
                  localStorage.removeItem(WRITER_NAME_KEY);
                  setWriterName(null);
                }}
                className="underline hover:opacity-80"
                style={{ color: "#6366f1" }}
              >
                Change
              </button>
            </div>
          )}
          <button
            onClick={onClose}
            className="text-[var(--color-fg-secondary)] hover:text-white transition-colors p-1"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Body: two panes */}
      <div className="flex flex-1 min-h-0">
        {/* Left: read-only version render */}
        <div className="flex-1 overflow-y-auto">
          {fountainLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="h-7 w-7 animate-spin rounded-full border-2 border-[#2a2a35] border-t-indigo-400" />
            </div>
          ) : (
            <PaginationEngineContext.Provider value={engine}>
              <div style={{ cursor: "default" }}>
                <EditorContent editor={editor} />
              </div>
            </PaginationEngineContext.Provider>
          )}
        </div>

        {/* Right: comment cards */}
        <div
          className="shrink-0 overflow-y-auto"
          style={{
            width: 380,
            borderLeft: "1px solid #1e1e28",
            background: "#13131a",
          }}
        >
          <div className="p-4 flex flex-col gap-3">
            {topLevel.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-[13px] font-sans" style={{ color: "#6b6b76" }}>
                  No comments on this version yet.
                </p>
                <p className="text-[12px] font-sans mt-1" style={{ color: "#4a5060" }}>
                  Share the version to get feedback.
                </p>
              </div>
            ) : (
              topLevel.map((ann) => {
                const replies = repliesByParent.get(ann.id) ?? [];
                return (
                  <div
                    key={ann.id}
                    ref={(el) => {
                      if (el) cardRefs.current.set(ann.id, el);
                      else cardRefs.current.delete(ann.id);
                    }}
                  >
                    <AnnotationCard
                      ann={ann}
                      scriptId={scriptId}
                      versionId={versionId}
                      isReply={false}
                      isPulsing={pulseCardId === ann.id}
                      onRefresh={refreshAnnotations}
                      onScrollToHighlight={scrollToHighlight}
                      onReply={() =>
                        requestName(() => setReplyOpenId(ann.id))
                      }
                    />

                    {/* Nested replies */}
                    {replies.map((reply) => (
                      <div key={reply.id} className="mt-2">
                        <AnnotationCard
                          ann={reply}
                          scriptId={scriptId}
                          versionId={versionId}
                          isReply={true}
                          isPulsing={false}
                          onRefresh={refreshAnnotations}
                          onScrollToHighlight={scrollToHighlight}
                        />
                      </div>
                    ))}

                    {/* Inline reply composer */}
                    {replyOpenId === ann.id && writerName && (
                      <ReplyComposer
                        parent={ann}
                        scriptId={scriptId}
                        versionId={versionId}
                        writerName={writerName}
                        onSubmit={async () => {
                          await refreshAnnotations();
                          setReplyOpenId(null);
                        }}
                        onCancel={() => setReplyOpenId(null)}
                      />
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {nameModalOpen && <WriterNameModal onConfirm={handleNameConfirm} />}
    </div>
  );
}
