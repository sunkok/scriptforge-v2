"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  FolderOpen,
  History,
  SlidersHorizontal,
  Printer,
} from "lucide-react";
import { useScriptForgeStore } from "@/lib/store";
import type { ScriptMetadata } from "@/lib/types";

const STATUS_CONFIG = {
  saved:    { dot: "bg-green-500",  label: "Saved" },
  saving:   { dot: "bg-indigo-500", label: "Saving…" },
  unsaved:  { dot: "bg-gray-500",   label: "Unsaved" },
  error:    { dot: "bg-red-500",    label: "Error" },
  loading:  { dot: "bg-gray-500",   label: "Loading…" },
  readonly: { dot: "bg-yellow-500", label: "Read only" },
} as const;

export default function EditorHeader() {
  const router = useRouter();
  const scriptTitle = useScriptForgeStore((s) => s.scriptTitle);
  const pageCount = useScriptForgeStore((s) => s.pageCount);
  const wordCount = useScriptForgeStore((s) => s.wordCount);
  const saveState = useScriptForgeStore((s) => s.saveState);
  const [creatingNew, setCreatingNew] = useState(false);

  const { dot, label } = STATUS_CONFIG[saveState];

  async function handleNew() {
    if (creatingNew) return;
    setCreatingNew(true);
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
      setCreatingNew(false);
    }
  }

  return (
    <header className="flex items-center justify-between px-5 shrink-0 h-14 bg-[#0b0d11] border-b border-[var(--color-border-subtle)]">
      <div className="flex flex-col justify-center min-w-0">
        <span className="text-white font-bold text-[18px] leading-tight truncate">
          {scriptTitle || "Untitled"}
        </span>
        <div className="flex items-center gap-0 text-[11px] text-[var(--color-fg-secondary)] leading-none mt-0.5">
          <span className={`inline-block w-1.5 h-1.5 rounded-full ${dot} mr-1.5 shrink-0`} />
          <span>{label}</span>
          <span className="mx-1.5">·</span>
          <span>~{pageCount} {pageCount === 1 ? "page" : "pages"}</span>
          <span className="mx-1.5">·</span>
          <span>{wordCount.toLocaleString()} words</span>
        </div>
      </div>

      <div className="flex items-center gap-0.5 shrink-0 ml-4">
        <HeaderButton
          icon={<Plus size={14} />}
          label={creatingNew ? "Creating…" : "New"}
          onClick={handleNew}
          disabled={creatingNew}
        />
        <HeaderButton
          icon={<FolderOpen size={14} />}
          label="Open"
          onClick={() => router.push("/")}
        />
        <HeaderButton
          icon={<History size={14} />}
          label="Versions"
          onClick={() => console.log("Versions clicked")}
        />
        <HeaderButton
          icon={<SlidersHorizontal size={14} />}
          label="Properties"
          onClick={() => console.log("Properties clicked")}
        />
        <HeaderButton
          icon={<Printer size={14} />}
          label="Print"
          onClick={() => console.log("Print clicked")}
        />
      </div>
    </header>
  );
}

function HeaderButton({
  icon,
  label,
  onClick,
  disabled,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-[var(--color-fg-secondary)] hover:text-indigo-400 text-[13px] font-sans transition-colors disabled:opacity-50"
      title={label}
    >
      {icon}
      <span className="hidden md:inline">{label}</span>
    </button>
  );
}
