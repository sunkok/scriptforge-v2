"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, ChevronRight, Plus } from "lucide-react";
import type { ScriptMetadata } from "@/lib/types";
import { relativeTime } from "@/lib/relative-time";

export default function ScriptLauncher() {
  const router = useRouter();
  const [scripts, setScripts] = useState<ScriptMetadata[] | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetch("/api/scripts")
      .then((r) => r.json())
      .then((data) => setScripts(data.scripts ?? []))
      .catch(() => setScripts([]));
  }, []);

  async function handleCreate() {
    if (creating) return;
    setCreating(true);
    try {
      const res = await fetch("/api/scripts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Untitled", fountain: "" }),
      });
      if (res.ok) {
        const data = (await res.json()) as ScriptMetadata;
        router.push(`/editor?id=${data.scriptId}`);
      }
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="w-full max-w-[480px] bg-[var(--color-surface)] border border-[var(--color-border-strong)] rounded-xl overflow-hidden shadow-[0_8px_40px_rgba(0,0,0,0.5)]">
      <div className="px-5 pt-5 pb-3 text-[10px] text-[var(--color-fg-secondary)] uppercase tracking-[0.12em] font-sans">
        Forge your scripts
      </div>

      {scripts === null ? (
        <div className="px-5 py-4 text-[13px] text-[var(--color-fg-secondary)] font-sans">
          Loading…
        </div>
      ) : scripts.length === 0 ? (
        <div className="px-5 py-4 text-[13px] text-[var(--color-fg-secondary)] font-sans">
          No scripts yet
        </div>
      ) : (
        scripts.map((script) => (
          <button
            key={script.scriptId}
            onClick={() => router.push(`/editor?id=${script.scriptId}`)}
            className="w-full flex items-center gap-3 px-5 py-3 hover:bg-[var(--color-border-subtle)] transition-colors group"
          >
            <FileText
              size={15}
              className="text-[var(--color-fg-secondary)] shrink-0 group-hover:text-indigo-400 transition-colors"
            />
            <span className="flex-1 text-left text-[var(--color-fg-primary)] text-[14px] font-sans truncate">
              {script.title || "Untitled"}
            </span>
            <span className="text-[var(--color-fg-secondary)] text-[12px] font-sans shrink-0">
              {relativeTime(script.updatedAt)}
            </span>
            <ChevronRight
              size={14}
              className="text-[var(--color-fg-secondary)] shrink-0 group-hover:text-indigo-400 transition-colors"
            />
          </button>
        ))
      )}

      <div className="border-t border-[var(--color-border-subtle)]" />

      <button
        onClick={handleCreate}
        disabled={creating}
        className="w-full flex items-center gap-3 px-5 py-3 hover:bg-[var(--color-border-subtle)] transition-colors group disabled:opacity-50"
      >
        <Plus
          size={15}
          className="text-indigo-400 shrink-0 group-hover:text-indigo-300 transition-colors"
        />
        <span className="text-indigo-400 text-[14px] font-sans group-hover:text-indigo-300 transition-colors">
          {creating ? "Creating…" : "Create new script"}
        </span>
      </button>
    </div>
  );
}
