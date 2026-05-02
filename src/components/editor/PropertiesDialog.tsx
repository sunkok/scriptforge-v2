"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useScriptForgeStore } from "@/lib/store";
import type { ScriptTitleBlock } from "@/lib/types";

interface Props {
  onClose: () => void;
}

/**
 * Converts an arbitrary date string to a YYYY-MM-DD value suitable for
 * an <input type="date">. Returns "" on parse failure.
 */
function toDateInputValue(dateStr?: string): string {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "";
    return d.toISOString().split("T")[0];
  } catch {
    return "";
  }
}

export default function PropertiesDialog({ onClose }: Props) {
  const currentScriptId = useScriptForgeStore((s) => s.currentScriptId);
  const titleBlock = useScriptForgeStore((s) => s.titleBlock);
  const scriptTitle = useScriptForgeStore((s) => s.scriptTitle);
  const setScriptTitle = useScriptForgeStore((s) => s.setScriptTitle);
  const setTitleBlock = useScriptForgeStore((s) => s.setTitleBlock);
  const setScriptMeta = useScriptForgeStore((s) => s.setScriptMeta);

  const [mounted, setMounted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form fields
  const [title, setTitle] = useState(titleBlock?.title || scriptTitle || "");
  const [author, setAuthor] = useState(titleBlock?.author || "");
  const [draft, setDraft] = useState(titleBlock?.draft || "");
  const [date, setDate] = useState(toDateInputValue(titleBlock?.date));
  const [contact, setContact] = useState(titleBlock?.contact || "");
  const [source, setSource] = useState(titleBlock?.source || "");

  const firstInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (mounted) firstInputRef.current?.focus();
  }, [mounted]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  function handleBackdrop(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) onClose();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!currentScriptId || saving) return;

    setSaving(true);
    setError(null);

    const trimmedTitle = title.trim();

    const newTitleBlock: ScriptTitleBlock = {
      title: trimmedTitle || undefined,
      author: author.trim() || undefined,
      draft: draft.trim() || undefined,
      date: date || undefined,
      contact: contact.trim() || undefined,
      source: source.trim() || undefined,
    };

    try {
      const res = await fetch(`/api/scripts/${currentScriptId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: trimmedTitle || scriptTitle,
          titleBlock: newTitleBlock,
        }),
      });

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(body || `Save failed (${res.status})`);
      }

      // Update store
      const finalTitle = trimmedTitle || scriptTitle;
      setScriptTitle(finalTitle);
      setTitleBlock(newTitleBlock);
      setScriptMeta({
        title: finalTitle,
        author: newTitleBlock.author ?? "",
        contact: newTitleBlock.contact ?? "",
        draftLabel: newTitleBlock.draft ?? "",
      });

      setSaved(true);
      setTimeout(() => {
        onClose();
      }, 800);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  if (!mounted) return null;

  const inputClass =
    "w-full px-3 py-2 rounded-lg text-[14px] font-sans text-white focus:outline-none focus:ring-1 focus:ring-indigo-500/60";
  const inputStyle = { background: "#0a0a10", border: "1px solid #2a2a35" };
  const labelClass = "block text-[12px] font-sans mb-1.5 font-medium";
  const labelStyle = { color: "#9099a8" };

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={handleBackdrop}
    >
      <div
        className="modal-glass w-full max-w-[480px] mx-4"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4" style={{ borderBottom: "1px solid #2a2a35" }}>
          <h2 className="text-white text-[17px] font-bold font-sans leading-snug">
            Script Properties
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg transition-colors hover:bg-white/10"
            style={{ color: "#9099a8" }}
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={(e) => void handleSubmit(e)} className="px-6 py-5">
          <div className="flex flex-col gap-4">
            {/* Title */}
            <div>
              <label className={labelClass} style={labelStyle}>Title</label>
              <input
                ref={firstInputRef}
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={200}
                className={inputClass}
                style={inputStyle}
                autoComplete="off"
                spellCheck={false}
              />
            </div>

            {/* Author */}
            <div>
              <label className={labelClass} style={labelStyle}>Author</label>
              <input
                type="text"
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                placeholder="Written by"
                maxLength={200}
                className={inputClass}
                style={inputStyle}
                autoComplete="off"
                spellCheck={false}
              />
            </div>

            {/* Draft + Date row */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass} style={labelStyle}>Draft</label>
                <input
                  type="text"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="First Draft, Revised Pages..."
                  maxLength={100}
                  className={inputClass}
                  style={inputStyle}
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>
              <div>
                <label className={labelClass} style={labelStyle}>Date</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className={inputClass}
                  style={{ ...inputStyle, colorScheme: "dark" }}
                />
              </div>
            </div>

            {/* Contact */}
            <div>
              <label className={labelClass} style={labelStyle}>Contact</label>
              <textarea
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                rows={3}
                placeholder="Name, address, email..."
                maxLength={500}
                className={`${inputClass} resize-none`}
                style={inputStyle}
                spellCheck={false}
              />
            </div>

            {/* Source */}
            <div>
              <label className={labelClass} style={labelStyle}>Source</label>
              <input
                type="text"
                value={source}
                onChange={(e) => setSource(e.target.value)}
                placeholder="Based on the novel by..."
                maxLength={200}
                className={inputClass}
                style={inputStyle}
                autoComplete="off"
                spellCheck={false}
              />
            </div>
          </div>

          {/* Error */}
          {error && (
            <p className="text-[12px] font-sans mt-3 leading-snug" style={{ color: "#f87171" }}>
              {error}
            </p>
          )}

          {/* Actions */}
          <div className="flex gap-2 justify-end mt-5">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 rounded-lg text-[13px] font-sans disabled:opacity-40 transition-colors"
              style={{ background: "#1e1e28", color: "#9099a8" }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || saved}
              className="px-4 py-2 rounded-lg text-[13px] font-sans font-semibold text-white disabled:opacity-60 transition-all"
              style={{ background: saved ? "#16a34a" : "#6366f1" }}
            >
              {saved ? "Saved!" : saving ? "Saving…" : "Save Properties"}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
