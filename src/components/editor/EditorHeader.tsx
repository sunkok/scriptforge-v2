"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  Home,
  Plus,
  FolderOpen,
  History,
  SlidersHorizontal,
  Printer,
} from "lucide-react";
import { useScriptForgeStore } from "@/lib/store";
import type { ScriptMetadata } from "@/lib/types";
import OpenScriptModal from "./OpenScriptModal";
import VersionsModal from "./VersionsModal";

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
  const savedSlotLabel = useScriptForgeStore((s) => s.savedSlotLabel);
  const isVersionsModalOpen = useScriptForgeStore((s) => s.isVersionsModalOpen);
  const setIsVersionsModalOpen = useScriptForgeStore((s) => s.setIsVersionsModalOpen);
  const activeProfile = useScriptForgeStore((s) => s.activeProfile);
  const setActiveProfile = useScriptForgeStore((s) => s.setActiveProfile);
  const [creatingNew, setCreatingNew] = useState(false);
  const [openModalVisible, setOpenModalVisible] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  // Close profile dropdown on outside click
  useEffect(() => {
    if (!profileMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target as Node)) {
        setProfileMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [profileMenuOpen]);

  const { dot, label: baseLabel } = STATUS_CONFIG[saveState];
  const label = saveState === "saved" && savedSlotLabel ? `Saved (${savedSlotLabel})` : baseLabel;

  async function handleNew() {
    if (creatingNew) return;
    if (!activeProfile) { router.push("/"); return; }
    setCreatingNew(true);
    try {
      const res = await fetch("/api/scripts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Untitled",
          fountain: "",
          ownerProfileId: activeProfile.profileId,
        }),
      });
      if (res.ok) {
        const data = (await res.json()) as ScriptMetadata;
        router.push(`/editor?id=${data.scriptId}`);
      }
    } finally {
      setCreatingNew(false);
    }
  }

  function handleSwitchProfile() {
    setProfileMenuOpen(false);
    setActiveProfile(null);
    router.push("/");
  }

  return (
    <>
      <header className="flex items-center justify-between px-5 shrink-0 h-14 bg-[#0b0d11] border-b border-[var(--color-border-subtle)]">
        {/* Left: home icon + title */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => { setActiveProfile(null); router.push("/"); }}
            className="shrink-0 p-1.5 -ml-1 rounded text-[var(--color-fg-secondary)] hover:text-indigo-400 transition-colors"
            title="Home"
          >
            <Home size={16} />
          </button>

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
        </div>

        {/* Right: profile indicator + action buttons */}
        <div className="flex items-center gap-0.5 shrink-0 ml-4">
          {activeProfile && (
            <div className="relative mr-1.5" ref={profileMenuRef}>
              <button
                onClick={() => setProfileMenuOpen((o) => !o)}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded text-[var(--color-fg-secondary)] hover:text-white text-[13px] font-sans transition-colors"
              >
                <span>{activeProfile.name}</span>
                <ChevronDown size={12} />
              </button>
              {profileMenuOpen && (
                <div className="absolute right-0 top-full mt-1 w-48 rounded-lg shadow-lg z-50 py-1"
                  style={{ background: "#13131a", border: "1px solid #2a2a35" }}>
                  <button
                    onClick={handleSwitchProfile}
                    className="w-full text-left px-4 py-2 text-[13px] font-sans transition-colors hover:text-white"
                    style={{ color: "#9099a8" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "#1e1e28")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "")}
                  >
                    Switch profile
                  </button>
                  <button
                    onClick={() => { setProfileMenuOpen(false); console.log("Manage profiles"); }}
                    className="w-full text-left px-4 py-2 text-[13px] font-sans transition-colors hover:text-white"
                    style={{ color: "#9099a8" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "#1e1e28")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "")}
                  >
                    Manage profiles
                  </button>
                </div>
              )}
            </div>
          )}
          <HeaderButton
            icon={<Plus size={14} />}
            label={creatingNew ? "Creating…" : "New"}
            onClick={handleNew}
            disabled={creatingNew}
          />
          <HeaderButton
            icon={<FolderOpen size={14} />}
            label="Open"
            onClick={() => setOpenModalVisible(true)}
          />
          <HeaderButton
            icon={<History size={14} />}
            label="Versions"
            onClick={() => setIsVersionsModalOpen(true)}
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

      {openModalVisible && (
        <OpenScriptModal onClose={() => setOpenModalVisible(false)} />
      )}
      {isVersionsModalOpen && (
        <VersionsModal onClose={() => setIsVersionsModalOpen(false)} />
      )}
    </>
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
