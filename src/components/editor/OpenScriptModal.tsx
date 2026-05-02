"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { X, FileText, Trash2 } from "lucide-react";
import type { ScriptMetadata } from "@/lib/types";
import { relativeTime } from "@/lib/relative-time";
import { useScriptForgeStore } from "@/lib/store";

interface Props {
  onClose: () => void;
}

export default function OpenScriptModal({ onClose }: Props) {
  const router = useRouter();
  const activeProfile = useScriptForgeStore((s) => s.activeProfile);
  const [scripts, setScripts] = useState<ScriptMetadata[] | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    fetchScripts();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function fetchScripts() {
    setScripts(null);
    const url = activeProfile
      ? `/api/scripts?profileId=${activeProfile.profileId}`
      : "/api/scripts";
    fetch(url)
      .then((r) => r.json())
      .then((data) => setScripts(data.scripts ?? []))
      .catch(() => setScripts([]));
  }

  async function handleDelete(script: ScriptMetadata, e: React.MouseEvent) {
    e.stopPropagation();
    const confirmed = window.confirm(
      `Delete "${script.title || "Untitled"}"? This cannot be undone.`
    );
    if (!confirmed) return;
    setDeleting(script.scriptId);
    try {
      await fetch(`/api/scripts/${script.scriptId}`, { method: "DELETE" });
      fetchScripts();
    } finally {
      setDeleting(null);
    }
  }

  function handleOpen(scriptId: string) {
    onClose();
    router.push(`/editor?id=${scriptId}`);
  }

  function handleBackdropClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) onClose();
  }

  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <div className="relative w-full max-w-[480px] mx-4 bg-[var(--color-surface)] border border-[var(--color-border-strong)] rounded-xl shadow-[0_16px_64px_rgba(0,0,0,0.6)] flex flex-col max-h-[70vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 shrink-0">
          <h2 className="text-white text-[20px] font-bold font-sans leading-none">
            Open Script
          </h2>
          <button
            onClick={onClose}
            className="text-[var(--color-fg-secondary)] hover:text-white transition-colors p-1 -mr-1"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Script list */}
        <div className="overflow-y-auto flex-1 border-t border-[var(--color-border-subtle)]">
          {scripts === null ? (
            <div className="px-5 py-6 text-[13px] text-[var(--color-fg-secondary)] font-sans">
              Loading…
            </div>
          ) : scripts.length === 0 ? (
            <div className="px-5 py-6 text-[13px] text-[var(--color-fg-secondary)] font-sans">
              No scripts yet
            </div>
          ) : (
            scripts.map((script) => (
              <div
                key={script.scriptId}
                onClick={() => handleOpen(script.scriptId)}
                className="flex items-center gap-3 px-5 py-3.5 hover:bg-[var(--color-border-subtle)] transition-colors cursor-pointer group border-b border-[var(--color-border-subtle)] last:border-b-0"
              >
                <FileText
                  size={15}
                  className="text-[var(--color-fg-secondary)] shrink-0 group-hover:text-indigo-400 transition-colors"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-white text-[14px] font-semibold font-sans truncate">
                    {script.title || "Untitled"}
                  </p>
                  <p className="text-[var(--color-fg-secondary)] text-[11px] font-sans mt-0.5">
                    saved {relativeTime(script.updatedAt)}
                  </p>
                </div>
                <button
                  onClick={(e) => handleDelete(script, e)}
                  disabled={deleting === script.scriptId}
                  className="shrink-0 p-1.5 rounded text-[var(--color-fg-secondary)] hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 disabled:opacity-50"
                  aria-label="Delete script"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
