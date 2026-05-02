"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";
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
import { AnnotationDecorations } from "@/lib/editor/annotation-decorations";
import { PaginationEngine } from "@/lib/pagination/engine";
import { fountainToTiptap } from "@/lib/fountain/parser";
import { buildAnchorMap } from "@/lib/fountain/anchor-mapping";
import { relativeTime } from "@/lib/relative-time";
import type { Annotation } from "@/lib/types";

const CustomDocument = Document.extend({ content: "page+" });
const REVIEWER_NAME_KEY = "reviewer-name";

// ─── types ────────────────────────────────────────────────────────────────────

type ShareData = {
  fountain: string;
  scriptTitle: string;
  versionLabel: string;
  scriptId: string;
  versionId: string;
};

type ErrorState = { status: number; message: string };

type SelectionInfo = {
  from: number;
  to: number;
  fountainStart: number;
  fountainEnd: number; // exclusive
  quote: string;
  buttonPos: { x: number; y: number };
};

// ─── name modal ───────────────────────────────────────────────────────────────

function ReviewerNameModal({ onConfirm }: { onConfirm: (name: string) => void }) {
  const [name, setName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const submit = () => {
    const t = name.trim();
    if (t) onConfirm(t);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div
        className="max-w-sm w-full mx-4 px-8 py-8 rounded-xl"
        style={{ background: "#13131a", border: "1px solid #2a2a35" }}
      >
        <p className="text-white text-[17px] font-bold font-sans mb-1">
          What's your name?
        </p>
        <p className="mb-5 text-[13px] font-sans" style={{ color: "#6b6b76" }}>
          Sun and others will see this on your comments.
        </p>
        <input
          ref={inputRef}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="Your name"
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

// ─── comment composer ─────────────────────────────────────────────────────────

function CommentComposer({
  token,
  reviewerName,
  selectionInfo,
  onSubmit,
  onCancel,
}: {
  token: string;
  reviewerName: string;
  selectionInfo: SelectionInfo;
  onSubmit: (annotation: Annotation) => void;
  onCancel: () => void;
}) {
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { textareaRef.current?.focus(); }, []);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) onCancel();
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [onCancel]);

  const submit = useCallback(async () => {
    const t = body.trim();
    if (!t || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/shares/${token}/annotations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          authorName: reviewerName,
          anchorStart: selectionInfo.fountainStart,
          anchorEnd: selectionInfo.fountainEnd,
          anchorQuote: selectionInfo.quote,
          body: t,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        const msg = (data as { error?: string }).error ?? "Failed to submit";
        setError(msg);
        setTimeout(() => setError(null), 3000);
        return;
      }
      onSubmit(data as Annotation);
    } catch {
      setError("Network error");
      setTimeout(() => setError(null), 3000);
    } finally {
      setLoading(false);
    }
  }, [body, loading, token, reviewerName, selectionInfo, onSubmit]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { onCancel(); return; }
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void submit();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel, submit]);

  const vw = typeof window !== "undefined" ? window.innerWidth : 1200;
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;
  const left = Math.min(selectionInfo.buttonPos.x, vw - 340);
  const top = Math.min(selectionInfo.buttonPos.y + 36, vh - 230);
  const snippet =
    selectionInfo.quote.length > 100
      ? selectionInfo.quote.slice(0, 100) + "…"
      : selectionInfo.quote;

  return (
    <div
      ref={rootRef}
      style={{
        position: "fixed",
        left,
        top,
        zIndex: 60,
        width: 320,
        background: "#13131a",
        border: "1px solid #2a2a35",
      }}
      className="rounded-xl shadow-2xl p-4"
    >
      <p className="text-[11px] font-sans mb-2" style={{ color: "#6b6b76" }}>
        Adding comment as{" "}
        <span style={{ color: "#9099a8" }}>{reviewerName}</span>
      </p>
      {snippet && (
        <p
          className="text-[12px] font-sans italic mb-2 leading-snug"
          style={{ color: "#5a6070" }}
        >
          "{snippet}"
        </p>
      )}
      <textarea
        ref={textareaRef}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Write your comment…"
        rows={3}
        className="w-full px-3 py-2 rounded-lg text-[13px] font-sans text-white focus:outline-none resize-none"
        style={{
          background: "#0a0a10",
          border: "1px solid #2a2a35",
          minHeight: 80,
        }}
      />
      {error && (
        <p className="text-[12px] font-sans mt-1" style={{ color: "#f87171" }}>
          {error}
        </p>
      )}
      <div className="flex items-center justify-end gap-2 mt-3">
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
          {loading ? "Submitting…" : "Submit"}
        </button>
      </div>
    </div>
  );
}

// ─── role pill helper ─────────────────────────────────────────────────────────

function RolePill({ role }: { role: string }) {
  const isWriter = role === "writer";
  return (
    <span
      className="shrink-0 text-[10px] font-sans px-1.5 py-0.5 rounded"
      style={{
        background: isWriter ? "#14532d" : "#1e1b2e",
        color: isWriter ? "#86efac" : "#a5b4fc",
      }}
    >
      {isWriter ? "Writer" : "Reviewer"}
    </span>
  );
}

// ─── reply item inside popover ────────────────────────────────────────────────

function ReplyItem({
  reply,
  token,
  viewerName,
  onRefresh,
}: {
  reply: Annotation;
  token: string;
  viewerName: string;
  onRefresh: () => Promise<void>;
}) {
  const [editMode, setEditMode] = useState(false);
  const [editBody, setEditBody] = useState(reply.body);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isOwn = reply.authorName === viewerName;

  useEffect(() => { setEditBody(reply.body); }, [reply.body]);

  const patch = async (updates: Partial<Annotation>): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/shares/${token}/annotations/${reply.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setError(data.error ?? "Failed");
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

  const confirmDelete = async () => {
    setLoading(true);
    try {
      await fetch(`/api/shares/${token}/annotations/${reply.id}`, { method: "DELETE" });
      await onRefresh();
    } catch {
      setError("Network error");
      setTimeout(() => setError(null), 3000);
      setLoading(false);
    }
  };

  return (
    <div style={{ borderLeft: "2px solid #2a2a3a", paddingLeft: 10, marginTop: 10 }}>
      <div className="flex items-center gap-1.5 flex-wrap mb-1">
        <span className="text-[12px] font-bold font-sans text-white">{reply.authorName}</span>
        <RolePill role={reply.authorRole} />
      </div>
      {editMode ? (
        <textarea
          value={editBody}
          onChange={(e) => setEditBody(e.target.value)}
          rows={2}
          autoFocus
          className="w-full px-2 py-1.5 rounded text-[12px] font-sans text-white focus:outline-none resize-none"
          style={{ background: "#0a0a10", border: "1px solid #2a2a35", minHeight: 52 }}
        />
      ) : (
        <p className="text-[12px] font-sans leading-snug" style={{ color: "#c8cdd8" }}>
          {reply.body}
        </p>
      )}
      <p className="text-[10px] font-sans mt-0.5" style={{ color: "#4a5060" }}>
        {relativeTime(reply.createdAt)}
      </p>
      {error && (
        <p className="text-[11px] font-sans mt-1" style={{ color: "#f87171" }}>{error}</p>
      )}
      {isOwn && (
        deleteConfirm ? (
          <div className="flex gap-1.5 mt-1.5">
            <button
              onClick={() => void confirmDelete()}
              disabled={loading}
              className="flex-1 py-1 rounded text-[11px] font-sans font-semibold text-white disabled:opacity-40"
              style={{ background: "#ef4444" }}
            >
              {loading ? "Deleting…" : "Delete"}
            </button>
            <button
              onClick={() => setDeleteConfirm(false)}
              className="flex-1 py-1 rounded text-[11px] font-sans"
              style={{ background: "#1f2535", color: "#9099a8" }}
            >
              Cancel
            </button>
          </div>
        ) : editMode ? (
          <div className="flex gap-1.5 mt-1.5">
            <button
              onClick={async () => { const ok = await patch({ body: editBody.trim() }); if (ok) setEditMode(false); }}
              disabled={!editBody.trim() || loading}
              className="flex-1 py-1 rounded text-[11px] font-sans font-semibold text-white disabled:opacity-40"
              style={{ background: "#6366f1" }}
            >
              {loading ? "Saving…" : "Save"}
            </button>
            <button
              onClick={() => { setEditMode(false); setEditBody(reply.body); }}
              className="flex-1 py-1 rounded text-[11px] font-sans"
              style={{ background: "#1f2535", color: "#9099a8" }}
            >
              Cancel
            </button>
          </div>
        ) : (
          <div className="flex gap-1.5 mt-1.5">
            <button
              onClick={() => setEditMode(true)}
              className="text-[11px] font-sans px-2 py-0.5 rounded"
              style={{ background: "#1f2535", color: "#9099a8" }}
            >
              Edit
            </button>
            <button
              onClick={() => setDeleteConfirm(true)}
              className="text-[11px] font-sans px-2 py-0.5 rounded"
              style={{ background: "#1f2535", color: "#f87171" }}
            >
              Delete
            </button>
          </div>
        )
      )}
    </div>
  );
}

// ─── annotation view popover ──────────────────────────────────────────────────

function AnnotationViewerPopover({
  token,
  annotation,
  replies,
  pos,
  reviewerName,
  onClose,
  onRefresh,
}: {
  token: string;
  annotation: Annotation;
  replies: Annotation[];
  pos: { x: number; y: number };
  reviewerName: string;
  onClose: () => void;
  onRefresh: () => Promise<void>;
}) {
  const [editMode, setEditMode] = useState(false);
  const [editBody, setEditBody] = useState(annotation.body);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [onClose]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => { setEditBody(annotation.body); }, [annotation.body]);

  const patch = async (updates: Partial<Annotation>): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/shares/${token}/annotations/${annotation.id}`,
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
      resolvedAt: annotation.resolvedAt ? null : new Date().toISOString(),
    });

  const confirmDelete = async () => {
    setLoading(true);
    try {
      await fetch(`/api/shares/${token}/annotations/${annotation.id}`, {
        method: "DELETE",
      });
      await onRefresh();
      onClose();
    } catch {
      setError("Network error");
      setTimeout(() => setError(null), 3000);
      setLoading(false);
    }
  };

  const vw = typeof window !== "undefined" ? window.innerWidth : 1200;
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;
  const left = Math.min(pos.x + 8, vw - 420);
  const top = Math.min(pos.y, vh - 320);
  const snippet =
    annotation.anchorQuote.length > 80
      ? annotation.anchorQuote.slice(0, 80) + "…"
      : annotation.anchorQuote;

  return (
    <div
      ref={rootRef}
      style={{
        position: "fixed",
        left,
        top,
        zIndex: 60,
        minWidth: 280,
        maxWidth: 400,
        background: "#13131a",
        border: "1px solid #2a2a35",
      }}
      className="rounded-xl shadow-2xl p-4"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 min-w-0 flex-wrap">
          <span className="text-[13px] font-bold font-sans text-white truncate">
            {annotation.authorName}
          </span>
          <RolePill role={annotation.authorRole} />
          {annotation.resolvedAt && (
            <span
              className="shrink-0 text-[10px] font-sans px-1.5 py-0.5 rounded"
              style={{ background: "#14532d", color: "#86efac" }}
            >
              Resolved
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          className="shrink-0 ml-2 opacity-40 hover:opacity-70 text-white"
          aria-label="Close"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path
              d="M1 1l12 12M13 1L1 13"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>

      {/* Quoted text */}
      {snippet && (
        <p
          className="text-[11px] font-sans italic mb-2 leading-snug"
          style={{ color: "#5a6070" }}
        >
          "{snippet}"
        </p>
      )}

      {/* Body / edit */}
      {editMode ? (
        <textarea
          value={editBody}
          onChange={(e) => setEditBody(e.target.value)}
          rows={3}
          autoFocus
          className="w-full px-3 py-2 rounded-lg text-[13px] font-sans text-white focus:outline-none resize-none"
          style={{
            background: "#0a0a10",
            border: "1px solid #2a2a35",
            minHeight: 72,
          }}
        />
      ) : (
        <p
          className="text-[13px] font-sans leading-snug mb-1"
          style={{ color: "#c8cdd8" }}
        >
          {annotation.body}
        </p>
      )}

      {/* Timestamp */}
      <p className="text-[11px] font-sans mb-3" style={{ color: "#4a5060" }}>
        {relativeTime(annotation.createdAt)}
      </p>

      {error && (
        <p className="text-[12px] font-sans mb-2" style={{ color: "#f87171" }}>
          {error}
        </p>
      )}

      {/* Delete confirm */}
      {deleteConfirm ? (
        <div>
          <p className="text-[12px] font-sans mb-2" style={{ color: "#d1d5db" }}>
            Delete this comment? This cannot be undone.
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
              style={{ background: "#1f2535", color: "#9099a8" }}
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
            onClick={() => { setEditMode(false); setEditBody(annotation.body); }}
            className="flex-1 py-1.5 rounded-lg text-[12px] font-sans"
            style={{ background: "#1f2535", color: "#9099a8" }}
          >
            Cancel
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setEditMode(true)}
            className="text-[12px] font-sans px-3 py-1 rounded-lg"
            style={{ background: "#1f2535", color: "#9099a8" }}
          >
            Edit
          </button>
          <button
            onClick={toggleResolve}
            disabled={loading}
            className="text-[12px] font-sans px-3 py-1 rounded-lg disabled:opacity-40"
            style={{ background: "#1f2535", color: "#9099a8" }}
          >
            {annotation.resolvedAt ? "Mark unresolved" : "Mark resolved"}
          </button>
          <button
            onClick={() => setDeleteConfirm(true)}
            className="text-[12px] font-sans px-3 py-1 rounded-lg"
            style={{ background: "#1f2535", color: "#f87171" }}
          >
            Delete
          </button>
        </div>
      )}

      {/* Replies */}
      {replies.length > 0 && (
        <div style={{ borderTop: "1px solid #1f1f2a", marginTop: 12, paddingTop: 4 }}>
          {replies.map((reply) => (
            <ReplyItem
              key={reply.id}
              reply={reply}
              token={token}
              viewerName={reviewerName}
              onRefresh={onRefresh}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── reviewer view ────────────────────────────────────────────────────────────

function ReviewerView({
  fountain,
  token,
  reviewerName,
}: {
  fountain: string;
  token: string;
  reviewerName: string;
}) {
  const engineRef = useRef<PaginationEngine | null>(null);
  const [engine, setEngine] = useState<PaginationEngine | null>(null);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [selectionInfo, setSelectionInfo] = useState<SelectionInfo | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  // Store ID only; look up live annotation from array so it's always fresh
  const [viewerAnnotationId, setViewerAnnotationId] = useState<string | null>(null);
  const [viewerPos, setViewerPos] = useState<{ x: number; y: number } | null>(null);
  const viewerAnnotation =
    viewerAnnotationId
      ? (annotations.find((a) => a.id === viewerAnnotationId) ?? null)
      : null;
  const viewerReplies = viewerAnnotationId
    ? annotations
        .filter((a) => a.parentId === viewerAnnotationId)
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    : [];

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
      AnnotationDecorations,
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

  const refreshAnnotations = useCallback(async () => {
    try {
      const res = await fetch(`/api/shares/${token}/annotations`);
      if (!res.ok) return;
      const data = (await res.json()) as { annotations?: Annotation[] };
      setAnnotations(data.annotations ?? []);
    } catch {
      // silently ignore network failures on refresh
    }
  }, [token]);

  // Fetch annotations once editor is ready
  useEffect(() => {
    if (editor) void refreshAnnotations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);

  // Push annotation list into decoration plugin
  useEffect(() => {
    if (editor) editor.commands.setAnnotations(annotations);
  }, [editor, annotations]);

  // Native selection → selectionInfo (works even with editable:false)
  useEffect(() => {
    if (!editor) return;
    const handleSelectionChange = () => {
      if (composerOpen) return;
      const nativeSel = window.getSelection();
      if (!nativeSel || nativeSel.isCollapsed || !nativeSel.rangeCount) {
        setSelectionInfo(null);
        return;
      }
      const range = nativeSel.getRangeAt(0);
      if (!editor.view.dom.contains(range.commonAncestorContainer)) {
        setSelectionInfo(null);
        return;
      }
      try {
        const from = editor.view.posAtDOM(range.startContainer, range.startOffset);
        const to = editor.view.posAtDOM(range.endContainer, range.endOffset);
        if (from < 0 || to < 0 || from >= to) { setSelectionInfo(null); return; }

        const text = editor.state.doc.textBetween(from, to, "\n");
        if (!text.trim()) { setSelectionInfo(null); return; }

        const { tiptapToFountain } = buildAnchorMap(editor.state.doc);
        const fountainStart = tiptapToFountain.get(from);
        const fountainEndChar = tiptapToFountain.get(to - 1);
        if (fountainStart === undefined || fountainEndChar === undefined) {
          setSelectionInfo(null);
          return;
        }

        const coords = editor.view.coordsAtPos(to);
        setSelectionInfo({
          from,
          to,
          fountainStart,
          fountainEnd: fountainEndChar + 1,
          quote: text.slice(0, 200),
          buttonPos: { x: coords.left, y: coords.bottom },
        });
      } catch {
        setSelectionInfo(null);
      }
    };
    document.addEventListener("selectionchange", handleSelectionChange);
    return () => document.removeEventListener("selectionchange", handleSelectionChange);
  }, [editor, composerOpen]);

  // Click on .annotation-highlight → open viewer
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
      setComposerOpen(false);
      setSelectionInfo(null);
      setViewerAnnotationId(id);
      setViewerPos({ x: e.clientX, y: e.clientY });
    };
    dom.addEventListener("click", handleClick);
    return () => dom.removeEventListener("click", handleClick);
  }, [editor]);

  const handleComposerSubmit = useCallback(
    async (_annotation: Annotation) => {
      setComposerOpen(false);
      setSelectionInfo(null);
      window.getSelection()?.removeAllRanges();
      await refreshAnnotations();
    },
    [refreshAnnotations]
  );

  const handleComposerCancel = useCallback(() => {
    setComposerOpen(false);
    setSelectionInfo(null);
    window.getSelection()?.removeAllRanges();
  }, []);

  return (
    <PaginationEngineContext.Provider value={engine}>
      <div style={{ cursor: "text" }}>
        <EditorContent editor={editor} />
      </div>

      {/* Floating "Add comment" button */}
      {selectionInfo && !composerOpen && (
        <button
          onMouseDown={(e) => {
            e.preventDefault(); // keeps native selection intact
            setComposerOpen(true);
          }}
          style={{
            position: "fixed",
            left: selectionInfo.buttonPos.x,
            top: selectionInfo.buttonPos.y + 8,
            zIndex: 55,
            background: "#6366f1",
            color: "white",
            border: "none",
            borderRadius: 8,
            padding: "5px 12px",
            fontSize: 12,
            fontFamily: "inherit",
            fontWeight: 600,
            cursor: "pointer",
            boxShadow: "0 2px 12px rgba(99,102,241,0.4)",
            userSelect: "none",
          }}
        >
          Add comment
        </button>
      )}

      {/* Comment composer */}
      {composerOpen && selectionInfo && (
        <CommentComposer
          token={token}
          reviewerName={reviewerName}
          selectionInfo={selectionInfo}
          onSubmit={handleComposerSubmit}
          onCancel={handleComposerCancel}
        />
      )}

      {/* Annotation viewer */}
      {viewerAnnotation && viewerPos && (
        <AnnotationViewerPopover
          key={viewerAnnotation.id}
          token={token}
          annotation={viewerAnnotation}
          replies={viewerReplies}
          pos={viewerPos}
          reviewerName={reviewerName}
          onClose={() => { setViewerAnnotationId(null); setViewerPos(null); }}
          onRefresh={refreshAnnotations}
        />
      )}
    </PaginationEngineContext.Provider>
  );
}

// ─── page ─────────────────────────────────────────────────────────────────────

export default function SharePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ShareData | null>(null);
  const [error, setError] = useState<ErrorState | null>(null);
  const [reviewerName, setReviewerName] = useState<string | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem(REVIEWER_NAME_KEY);
    if (stored) setReviewerName(stored);
  }, []);

  useEffect(() => {
    fetch(`/api/shares/${token}`)
      .then(async (res) => {
        const body = (await res.json()) as {
          fountain?: string;
          scriptTitle?: string;
          versionLabel?: string;
          scriptId?: string;
          versionId?: string;
          error?: string;
        };
        if (!res.ok) {
          setError({
            status: res.status,
            message: body.error ?? "Failed to load",
          });
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
      .catch(() =>
        setError({ status: 500, message: "Failed to load shared script" })
      )
      .finally(() => setLoading(false));
  }, [token]);

  const handleNameConfirm = (name: string) => {
    localStorage.setItem(REVIEWER_NAME_KEY, name);
    setReviewerName(name);
  };

  const clearName = () => {
    localStorage.removeItem(REVIEWER_NAME_KEY);
    setReviewerName(null);
  };

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
      error.status === 404
        ? "Share link not found."
        : error.status === 410
          ? "This link is no longer available."
          : "Something went wrong.";
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#0f0f14]">
        <div
          className="max-w-sm w-full mx-4 px-8 py-10 text-center rounded-xl"
          style={{ background: "#13131a", border: "1px solid #2a2a35" }}
        >
          <p className="text-white text-[17px] font-bold font-sans">{heading}</p>
          <p className="mt-2 text-[13px] text-[#6b6b76] font-sans">
            {error.message}
          </p>
        </div>
      </main>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-[#0f0f14]">
      {/* Header */}
      <header className="flex items-center justify-between px-5 shrink-0 h-14 bg-[#0b0d11] border-b border-[var(--color-border-subtle)]">
        <div className="flex items-center gap-3 min-w-0">
          <span
            className="shrink-0 text-[11px] font-bold font-sans px-1.5 py-0.5 rounded"
            style={{
              background: "#6366f1",
              color: "white",
              letterSpacing: "0.04em",
            }}
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

        <div className="flex items-center gap-4 shrink-0">
          {reviewerName && (
            <div
              className="flex items-center gap-1.5 text-[12px] font-sans"
              style={{ color: "#6b6b76" }}
            >
              <span>
                Editing as:{" "}
                <span style={{ color: "#9099a8" }}>{reviewerName}</span>
              </span>
              <button
                onClick={clearName}
                className="underline hover:opacity-80"
                style={{ color: "#6366f1" }}
              >
                Change
              </button>
            </div>
          )}
          <div
            className="flex items-center gap-1.5 text-[12px] font-sans"
            style={{ color: "#6b6b76" }}
          >
            <Eye size={13} />
            <span>Read-only view</span>
          </div>
        </div>
      </header>

      {/* Name prompt — shown as overlay, viewer rendered below */}
      {!reviewerName && <ReviewerNameModal onConfirm={handleNameConfirm} />}

      {/* Script canvas */}
      <main className="flex-1 overflow-y-auto py-10">
        {reviewerName ? (
          <ReviewerView
            fountain={data!.fountain}
            token={token}
            reviewerName={reviewerName}
          />
        ) : (
          // Blurred placeholder while name modal is open
          <div
            style={{
              filter: "blur(4px)",
              opacity: 0.3,
              pointerEvents: "none",
              userSelect: "none",
            }}
          >
            <div className="max-w-2xl mx-auto px-8">
              <div
                className="h-4 rounded mb-3"
                style={{ background: "#2a2a35", width: "60%" }}
              />
              <div
                className="h-4 rounded mb-3"
                style={{ background: "#2a2a35", width: "80%" }}
              />
              <div
                className="h-4 rounded mb-3"
                style={{ background: "#2a2a35", width: "45%" }}
              />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
