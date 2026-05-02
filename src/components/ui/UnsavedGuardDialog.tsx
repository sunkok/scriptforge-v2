"use client";

import { useState } from "react";
import { createPortal } from "react-dom";

interface Props {
  destination: string;
  onSave: () => Promise<void>;
  onDiscard: () => void;
  onCancel: () => void;
}

export default function UnsavedGuardDialog({
  destination,
  onSave,
  onDiscard,
  onCancel,
}: Props) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      await onSave();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed. Try again.");
      setSaving(false);
    }
  }

  function handleBackdrop(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) onCancel();
  }

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
          Unsaved changes
        </h2>
        <p className="text-[13px] font-sans leading-relaxed mb-5" style={{ color: "#9099a8" }}>
          You have unsaved changes. Save before{" "}
          <span style={{ color: "#c8cdd8" }}>{destination}</span>?
        </p>

        {error && (
          <p className="text-[12px] font-sans mb-3 leading-snug" style={{ color: "#f87171" }}>
            {error}
          </p>
        )}

        <div className="flex gap-2 justify-end">
          <button
            onClick={onCancel}
            disabled={saving}
            className="px-4 py-2 rounded-lg text-[13px] font-sans disabled:opacity-40 transition-colors"
            style={{ background: "#1e1e28", color: "#9099a8" }}
          >
            Cancel
          </button>
          <button
            onClick={onDiscard}
            disabled={saving}
            className="px-4 py-2 rounded-lg text-[13px] font-sans font-semibold disabled:opacity-40 transition-colors"
            style={{ color: "#f87171", background: "transparent" }}
          >
            Discard
          </button>
          <button
            onClick={() => void handleSave()}
            disabled={saving}
            className="px-4 py-2 rounded-lg text-[13px] font-sans font-semibold text-white disabled:opacity-40 transition-opacity"
            style={{ background: "#6366f1" }}
          >
            {saving ? "Saving…" : "Save and continue"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
