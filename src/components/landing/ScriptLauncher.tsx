"use client";

import { useRouter } from "next/navigation";
import { FileText, ChevronRight, Plus } from "lucide-react";

const PLACEHOLDER_SCRIPTS = [
  { id: "resonant-skies", title: "Resonant Skies", ago: "3h ago" },
  { id: "project-daisy", title: "Project Daisy", ago: "9h ago" },
];

export default function ScriptLauncher() {
  const router = useRouter();

  return (
    <div className="w-full max-w-[480px] bg-[var(--color-surface)] border border-[var(--color-border-strong)] rounded-xl overflow-hidden shadow-[0_8px_40px_rgba(0,0,0,0.5)]">
      <div className="px-5 pt-5 pb-3 text-[10px] text-[var(--color-fg-secondary)] uppercase tracking-[0.12em] font-sans">
        Forge your scripts
      </div>

      {PLACEHOLDER_SCRIPTS.map((script) => (
        <button
          key={script.id}
          onClick={() => console.log("open script", script.id)}
          className="w-full flex items-center gap-3 px-5 py-3 hover:bg-[var(--color-border-subtle)] transition-colors group"
        >
          <FileText
            size={15}
            className="text-[var(--color-fg-secondary)] shrink-0 group-hover:text-indigo-400 transition-colors"
          />
          <span className="flex-1 text-left text-[var(--color-fg-primary)] text-[14px] font-sans">
            {script.title}
          </span>
          <span className="text-[var(--color-fg-secondary)] text-[12px] font-sans">
            {script.ago}
          </span>
          <ChevronRight
            size={14}
            className="text-[var(--color-fg-secondary)] shrink-0 group-hover:text-indigo-400 transition-colors"
          />
        </button>
      ))}

      <div className="border-t border-[var(--color-border-subtle)]" />

      <button
        onClick={() => router.push("/editor")}
        className="w-full flex items-center gap-3 px-5 py-3 hover:bg-[var(--color-border-subtle)] transition-colors group"
      >
        <Plus
          size={15}
          className="text-indigo-400 shrink-0 group-hover:text-indigo-300 transition-colors"
        />
        <span className="text-indigo-400 text-[14px] font-sans group-hover:text-indigo-300 transition-colors">
          Create new script
        </span>
      </button>
    </div>
  );
}
