"use client";

import {
  Plus,
  FolderOpen,
  History,
  SlidersHorizontal,
  Printer,
} from "lucide-react";
import { useScriptForgeStore } from "@/lib/store";

export default function EditorHeader() {
  const title = useScriptForgeStore((s) => s.scriptMeta.title);
  const pageCount = useScriptForgeStore((s) => s.pageCount);
  const wordCount = useScriptForgeStore((s) => s.wordCount);

  const displayTitle = title || "Untitled";

  return (
    <header className="flex items-center justify-between px-5 shrink-0 h-14 bg-[#0b0d11] border-b border-[var(--color-border-subtle)]">
      <div className="flex flex-col justify-center min-w-0">
        <span className="text-white font-bold text-[18px] leading-tight truncate">
          {displayTitle}
        </span>
        <div className="flex items-center gap-0 text-[11px] text-[var(--color-fg-secondary)] leading-none mt-0.5">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-500 mr-1.5 shrink-0" />
          <span>Saved</span>
          <span className="mx-1.5">·</span>
          <span>~{pageCount} {pageCount === 1 ? "page" : "pages"}</span>
          <span className="mx-1.5">·</span>
          <span>{wordCount.toLocaleString()} words</span>
        </div>
      </div>

      <div className="flex items-center gap-0.5 shrink-0 ml-4">
        <HeaderButton
          icon={<Plus size={14} />}
          label="New"
          onClick={() => console.log("New clicked")}
        />
        <HeaderButton
          icon={<FolderOpen size={14} />}
          label="Open"
          onClick={() => console.log("Open clicked")}
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
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-[var(--color-fg-secondary)] hover:text-indigo-400 text-[13px] font-sans transition-colors"
      title={label}
    >
      {icon}
      <span className="hidden md:inline">{label}</span>
    </button>
  );
}
