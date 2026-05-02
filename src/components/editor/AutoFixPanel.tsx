"use client";

import { useState, useEffect, useCallback } from "react";
import { X, AlertCircle, ArrowRight, CheckCircle2 } from "lucide-react";
import type { Editor } from "@tiptap/core";
import { scanDocument, type IssueWithLocation } from "@/lib/editor/scan-document";
import { ELEMENT_DISPLAY_NAMES, isElementType } from "@/lib/editor/types";

interface Props {
  editor: Editor;
  onClose: () => void;
}

export default function AutoFixPanel({ editor, onClose }: Props) {
  const [items, setItems] = useState<IssueWithLocation[]>(() =>
    scanDocument(editor.state.doc)
  );
  const [allDone, setAllDone] = useState(false);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  // When list empties, show done state then auto-close
  useEffect(() => {
    if (items.length === 0 && !allDone) {
      setAllDone(true);
      const t = setTimeout(onClose, 1000);
      return () => clearTimeout(t);
    }
  }, [items, allDone, onClose]);

  const applyFix = useCallback(
    (item: IssueWithLocation) => {
      const { state, view } = editor;
      const node = state.doc.nodeAt(item.nodePos);
      if (!node) return;

      // Replace the node's text content, preserving node type and attrs
      const from = item.nodePos + 1; // inside the node
      const to = item.nodePos + 1 + node.content.size;
      const tr = state.tr.insertText(item.issue.fix, from, to);
      view.dispatch(tr);

      setItems((prev) => prev.filter((i) => i !== item));
    },
    [editor]
  );

  const applyAll = useCallback(() => {
    const fixable = items.filter((i) => i.issue.fix !== i.originalText);
    if (fixable.length === 0) {
      setItems([]);
      return;
    }

    const { state, view } = editor;
    let tr = state.tr;

    // Apply fixes in reverse position order so earlier offsets stay valid
    const sorted = [...fixable].sort((a, b) => b.nodePos - a.nodePos);
    for (const item of sorted) {
      const node = tr.doc.nodeAt(item.nodePos);
      if (!node) continue;
      const from = item.nodePos + 1;
      const to = item.nodePos + 1 + node.content.size;
      tr = tr.insertText(item.issue.fix, from, to);
    }
    view.dispatch(tr);
    setItems([]);
  }, [editor, items]);

  const skip = useCallback((item: IssueWithLocation) => {
    setItems((prev) => prev.filter((i) => i !== item));
  }, []);

  const fixableCount = items.filter((i) => i.issue.fix !== i.originalText).length;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40"
        onClick={onClose}
      />

      {/* Slideover */}
      <div
        className="fixed top-0 right-0 bottom-0 z-50 flex flex-col"
        style={{
          width: "520px",
          background: "#13131a",
          borderLeft: "1px solid #2a2a35",
          boxShadow: "-8px 0 40px rgba(0,0,0,0.5)",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 shrink-0"
          style={{ borderBottom: "1px solid #2a2a35" }}
        >
          <div className="flex items-center gap-2.5">
            <span className="text-white font-semibold font-sans text-[15px]">
              Formatting issues
            </span>
            {items.length > 0 && (
              <span
                className="px-2 py-0.5 rounded-full text-[11px] font-semibold font-sans"
                style={{ background: "#6366f1", color: "#fff" }}
              >
                {items.length}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {fixableCount > 0 && (
              <button
                onClick={applyAll}
                className="px-3 py-1.5 rounded text-[12px] font-semibold font-sans text-white transition-colors"
                style={{ background: "#6366f1" }}
              >
                Fix all ({fixableCount})
              </button>
            )}
            <button
              onClick={onClose}
              className="w-7 h-7 flex items-center justify-center rounded text-[#6b6b76] hover:text-[#9099a8] transition-colors"
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Issue list */}
        <div className="flex-1 overflow-y-auto py-3 px-3">
          {allDone ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-[#6b6b76]">
              <CheckCircle2 size={28} className="text-indigo-400" />
              <span className="font-sans text-[14px]">All done!</span>
            </div>
          ) : items.length === 0 ? null : (
            items.map((item, idx) => {
              const isFixable = item.issue.fix !== item.originalText;
              const displayName = isElementType(item.nodeType)
                ? ELEMENT_DISPLAY_NAMES[item.nodeType]
                : item.nodeType;

              return (
                <div
                  key={idx}
                  className="rounded-lg mb-2 p-3.5"
                  style={{ background: "#1a1a24", border: "1px solid #2a2a35" }}
                >
                  {/* Top row: icon + type + message */}
                  <div className="flex items-start gap-2.5 mb-3">
                    <AlertCircle
                      size={14}
                      className="shrink-0 mt-0.5"
                      style={{ color: isFixable ? "#f59e0b" : "#6b6b76" }}
                    />
                    <div className="flex-1 min-w-0">
                      <span
                        className="text-[11px] font-semibold font-sans uppercase tracking-wide mr-2"
                        style={{ color: "#6366f1" }}
                      >
                        {displayName}
                      </span>
                      <span
                        className="text-[12px] font-sans"
                        style={{ color: "#9099a8" }}
                      >
                        {item.issue.message}
                      </span>
                    </div>
                  </div>

                  {/* Before/after row */}
                  <div className="flex items-center gap-2 mb-3 pl-[22px]">
                    <span
                      className="text-[12px] truncate flex-1"
                      style={{
                        fontFamily: "var(--font-courier-prime), 'Courier New', monospace",
                        color: "#4a4a58",
                        maxWidth: "180px",
                      }}
                      title={item.originalText}
                    >
                      {item.originalText}
                    </span>
                    {isFixable && (
                      <>
                        <ArrowRight size={12} style={{ color: "#4a4a58" }} className="shrink-0" />
                        <span
                          className="text-[12px] truncate flex-1"
                          style={{
                            fontFamily: "var(--font-courier-prime), 'Courier New', monospace",
                            color: "#c8cdd8",
                            maxWidth: "180px",
                          }}
                          title={item.issue.fix}
                        >
                          {item.issue.fix}
                        </span>
                      </>
                    )}
                    {!isFixable && (
                      <span
                        className="text-[11px] font-sans italic"
                        style={{ color: "#6b6b76" }}
                      >
                        Manual fix needed
                      </span>
                    )}
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center justify-end gap-2 pl-[22px]">
                    <button
                      onClick={() => skip(item)}
                      className="px-2.5 py-1 rounded text-[11px] font-sans transition-colors"
                      style={{
                        background: "#1e1e28",
                        color: "#6b6b76",
                        border: "1px solid #2a2a35",
                      }}
                    >
                      Skip
                    </button>
                    {isFixable && (
                      <button
                        onClick={() => applyFix(item)}
                        className="px-2.5 py-1 rounded text-[11px] font-semibold font-sans text-white transition-colors"
                        style={{ background: "#6366f1" }}
                      >
                        Fix
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </>
  );
}
