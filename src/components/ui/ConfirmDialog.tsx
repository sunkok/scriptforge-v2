"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

interface Props {
  title: string;
  body: string;
  confirmLabel?: string;
  confirmVariant?: "danger" | "default";
  onConfirm: () => Promise<void>;
  onCancel: () => void;
}

export default function ConfirmDialog({
  title,
  body,
  confirmLabel = "Confirm",
  confirmVariant = "default",
  onConfirm,
  onCancel,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onCancel(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);

  async function handleConfirm() {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      await onConfirm();
      onCancel();
    } catch {
      setError("Failed to delete. Try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleBackdrop(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) onCancel();
  }

  if (!mounted) return null;

  const confirmBg = confirmVariant === "danger" ? "#ef4444" : "#6366f1";

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={handleBackdrop}
    >
      <div className="modal-glass w-full max-w-[400px] mx-4 p-6">
        <h2 className="text-white text-[18px] font-bold font-sans mb-3 leading-snug">
          {title}
        </h2>
        <p className="text-[13px] font-sans leading-relaxed mb-5" style={{ color: "#9099a8" }}>
          {body}
        </p>

        {error && (
          <p className="text-[12px] font-sans mb-3" style={{ color: "#f87171" }}>
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
            onClick={() => void handleConfirm()}
            disabled={loading}
            className="px-4 py-2 rounded-lg text-[13px] font-sans font-semibold text-white disabled:opacity-50 transition-opacity"
            style={{ background: confirmBg }}
          >
            {loading ? "Deleting…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
