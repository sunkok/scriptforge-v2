"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

interface Props {
  title: string;
  body?: string;
  placeholder?: string;
  defaultValue?: string;
  confirmLabel?: string;
  onConfirm: (value: string) => Promise<void>;
  onCancel: () => void;
}

export default function NameInputDialog({
  title,
  body,
  placeholder,
  defaultValue = "",
  confirmLabel = "Create",
  onConfirm,
  onCancel,
}: Props) {
  const [value, setValue] = useState(defaultValue);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => { if (mounted) inputRef.current?.focus(); }, [mounted]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onCancel(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);

  const trimmed = value.trim();
  const canSubmit = trimmed.length > 0 && trimmed.length <= 200;

  async function handleSubmit() {
    if (!canSubmit || loading) return;
    setLoading(true);
    setError(null);
    try {
      await onConfirm(trimmed);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setLoading(false);
    }
  }

  function handleBackdrop(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) onCancel();
  }

  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={handleBackdrop}
    >
      <div
        className="w-full max-w-[400px] mx-4 rounded-xl shadow-[0_16px_64px_rgba(0,0,0,0.6)] p-6"
        style={{ background: "#13131a", border: "1px solid #2a2a35" }}
      >
        <h2 className="text-white text-[18px] font-bold font-sans mb-2 leading-snug">
          {title}
        </h2>
        {body && (
          <p className="text-[13px] font-sans leading-relaxed mb-4" style={{ color: "#9099a8" }}>
            {body}
          </p>
        )}
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") void handleSubmit(); }}
          placeholder={placeholder}
          maxLength={200}
          className="w-full px-3 py-2 rounded-lg text-[14px] font-sans text-white focus:outline-none mb-4"
          style={{ background: "#0a0a10", border: "1px solid #2a2a35" }}
          autoComplete="off"
          spellCheck={false}
        />
        {error && (
          <p className="text-[12px] font-sans mb-3 leading-snug" style={{ color: "#f87171" }}>
            {error}
          </p>
        )}
        <div className="flex gap-2 justify-end">
          <button
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 rounded-lg text-[13px] font-sans disabled:opacity-40 transition-colors"
            style={{ background: "#1e1e28", color: "#9099a8" }}
          >
            Cancel
          </button>
          <button
            onClick={() => void handleSubmit()}
            disabled={!canSubmit || loading}
            className="px-4 py-2 rounded-lg text-[13px] font-sans font-semibold text-white disabled:opacity-40 transition-opacity"
            style={{ background: "#6366f1" }}
          >
            {loading ? "Creating…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
