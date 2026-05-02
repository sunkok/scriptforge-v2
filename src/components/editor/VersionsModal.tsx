"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useScriptForgeStore } from "@/lib/store";
import type { AutosaveSnapshot, VersionMetadata } from "@/lib/types";
import { relativeTime } from "@/lib/relative-time";

type Tab = "versions" | "autosaves" | "shares";

const TABS: { id: Tab; label: string }[] = [
  { id: "versions", label: "Versions" },
  { id: "autosaves", label: "Auto-saves" },
  { id: "shares", label: "Shares" },
];

// ─── helpers ──────────────────────────────────────────────────────────────────

function todayUTC() {
  return new Date().toISOString().split("T")[0];
}

function yesterdayUTC() {
  return new Date(Date.now() - 86_400_000).toISOString().split("T")[0];
}

function dateHeader(date: string): string {
  const today = todayUTC();
  const yesterday = yesterdayUTC();
  if (date === today) return "TODAY";
  if (date === yesterday) return "YESTERDAY";
  return new Date(date + "T00:00:00Z").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatSlotTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

interface DateGroup {
  date: string;
  label: string;
  items: AutosaveSnapshot[];
}

function groupByDate(snapshots: AutosaveSnapshot[]): DateGroup[] {
  const map = new Map<string, AutosaveSnapshot[]>();
  for (const s of snapshots) {
    if (!map.has(s.date)) map.set(s.date, []);
    map.get(s.date)!.push(s);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, items]) => ({
      date,
      label: dateHeader(date),
      items: [...items].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      ),
    }));
}

// ─── modal ────────────────────────────────────────────────────────────────────

interface Props {
  onClose: () => void;
}

export default function VersionsModal({ onClose }: Props) {
  const currentScriptId = useScriptForgeStore((s) => s.currentScriptId);
  const versions = useScriptForgeStore((s) => s.versions);
  const setVersions = useScriptForgeStore((s) => s.setVersions);
  const autosaves = useScriptForgeStore((s) => s.autosaves);
  const setAutosaves = useScriptForgeStore((s) => s.setAutosaves);

  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("versions");
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [autosavesLoading, setAutosavesLoading] = useState(false);

  const [showSaveForm, setShowSaveForm] = useState(false);
  const [labelInput, setLabelInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [flashVersionId, setFlashVersionId] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setMounted(true); }, []);

  // Fetch versions on open.
  useEffect(() => {
    if (!currentScriptId) return;
    setVersionsLoading(true);
    fetch(`/api/scripts/${currentScriptId}/versions`)
      .then((r) => r.json())
      .then((data) => setVersions(data.versions ?? []))
      .catch(() => {})
      .finally(() => setVersionsLoading(false));
  }, [currentScriptId]);

  // Fetch autosaves when that tab becomes active.
  useEffect(() => {
    if (activeTab !== "autosaves" || !currentScriptId) return;
    setAutosavesLoading(true);
    fetch(`/api/scripts/${currentScriptId}/autosaves`)
      .then((r) => r.json())
      .then((data) => setAutosaves(data.snapshots ?? []))
      .catch(() => {})
      .finally(() => setAutosavesLoading(false));
  }, [activeTab, currentScriptId]);

  function handleBackdropClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) onClose();
  }

  function openSaveForm() {
    setLabelInput(`Draft ${versions.length + 1}`);
    setShowSaveForm(true);
    setSaveError(null);
    setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 50);
  }

  async function handleSaveVersion() {
    if (!currentScriptId || saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      const label = labelInput.trim() || `Draft ${versions.length + 1}`;
      const res = await fetch(`/api/scripts/${currentScriptId}/versions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label }),
      });
      if (!res.ok) throw new Error("server error");
      const newVersion = (await res.json()) as VersionMetadata;

      const listRes = await fetch(`/api/scripts/${currentScriptId}/versions`);
      const data = await listRes.json();
      setVersions(data.versions ?? []);

      setShowSaveForm(false);
      setFlashVersionId(newVersion.versionId);
      setTimeout(() => setFlashVersionId(null), 1000);
    } catch {
      setSaveError("Failed to save");
      setTimeout(() => setSaveError(null), 3000);
    } finally {
      setSaving(false);
    }
  }

  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <div
        className="relative w-full mx-4 flex flex-col"
        style={{
          maxWidth: "720px",
          maxHeight: "70vh",
          background: "#13131a",
          border: "1px solid #2a2a35",
          borderRadius: "12px",
          boxShadow: "0 20px 80px rgba(0,0,0,0.7)",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 shrink-0">
          <h2 className="text-white text-[20px] font-bold font-sans leading-none">
            Version History
          </h2>
          <button
            onClick={onClose}
            className="text-[var(--color-fg-secondary)] hover:text-white transition-colors p-1 -mr-1"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex shrink-0 px-6" style={{ borderBottom: "1px solid #2a2a35" }}>
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`text-[13px] font-sans pb-[11px] mr-5 transition-colors border-b-2 ${
                activeTab === tab.id
                  ? "text-white border-indigo-500"
                  : "text-[#6b6b76] border-transparent hover:text-indigo-400"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="overflow-y-auto flex-1 px-6 py-5">
          {activeTab === "versions" && (
            <VersionsTab
              versions={versions}
              loading={versionsLoading}
              showSaveForm={showSaveForm}
              labelInput={labelInput}
              setLabelInput={setLabelInput}
              saving={saving}
              saveError={saveError}
              flashVersionId={flashVersionId}
              inputRef={inputRef}
              onOpenSaveForm={openSaveForm}
              onSave={handleSaveVersion}
              onCancelSave={() => setShowSaveForm(false)}
            />
          )}

          {activeTab === "autosaves" && (
            <AutosavesTab snapshots={autosaves} loading={autosavesLoading} />
          )}

          {activeTab === "shares" && (
            <div className="flex items-center justify-center py-10 text-[13px] text-[#6b6b76] font-sans">
              Share links coming soon
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── Versions tab ─────────────────────────────────────────────────────────────

function VersionsTab({
  versions,
  loading,
  showSaveForm,
  labelInput,
  setLabelInput,
  saving,
  saveError,
  flashVersionId,
  inputRef,
  onOpenSaveForm,
  onSave,
  onCancelSave,
}: {
  versions: VersionMetadata[];
  loading: boolean;
  showSaveForm: boolean;
  labelInput: string;
  setLabelInput: (v: string) => void;
  saving: boolean;
  saveError: string | null;
  flashVersionId: string | null;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onOpenSaveForm: () => void;
  onSave: () => void;
  onCancelSave: () => void;
}) {
  return (
    <>
      <div className="flex items-center gap-3 mb-5">
        {!showSaveForm ? (
          <button
            onClick={onOpenSaveForm}
            className="px-3.5 py-2 text-[13px] font-sans font-medium text-white rounded-md bg-indigo-500 hover:bg-indigo-600 transition-colors"
          >
            Save as new version
          </button>
        ) : (
          <>
            <input
              ref={inputRef}
              type="text"
              value={labelInput}
              onChange={(e) => setLabelInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") onSave();
                if (e.key === "Escape") onCancelSave();
              }}
              className="px-3 py-2 text-[13px] font-sans text-white rounded-md outline-none"
              style={{ width: "240px", background: "#1e1e28", border: "1px solid #3a3a4a" }}
              placeholder="Version label"
              disabled={saving}
            />
            <button
              onClick={onSave}
              disabled={saving}
              className="px-3.5 py-2 text-[13px] font-sans font-medium text-white rounded-md bg-indigo-500 hover:bg-indigo-600 transition-colors disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save"}
            </button>
            <button
              onClick={onCancelSave}
              disabled={saving}
              className="px-3.5 py-2 text-[13px] font-sans text-[#6b6b76] rounded-md hover:text-white transition-colors"
            >
              Cancel
            </button>
          </>
        )}
        {saveError && (
          <span className="text-[12px] text-red-400 font-sans">{saveError}</span>
        )}
      </div>

      {loading ? (
        <div className="text-[13px] text-[var(--color-fg-secondary)] font-sans">Loading…</div>
      ) : versions.length === 0 ? (
        <div className="text-center py-8 text-[13px] text-[#6b6b76] font-sans">
          No versions yet. Save one above.
        </div>
      ) : (
        versions.map((v) => (
          <VersionRow key={v.versionId} version={v} flash={v.versionId === flashVersionId} />
        ))
      )}
    </>
  );
}

function VersionRow({ version, flash }: { version: VersionMetadata; flash: boolean }) {
  return (
    <div
      className="flex items-center gap-4 py-3.5"
      style={{
        borderBottom: "1px solid #1e1e28",
        background: flash ? "rgba(99, 102, 241, 0.12)" : "transparent",
        transition: "background 1s ease",
      }}
    >
      <div className="flex-1 min-w-0">
        <p className="text-white text-[14px] font-semibold font-sans leading-tight">
          {version.label}
        </p>
        <p className="text-[#6b6b76] text-[11px] font-sans mt-0.5">
          {relativeTime(version.createdAt)}
        </p>
      </div>

      {(version.pageCount != null || version.wordCount != null) && (
        <div className="shrink-0 text-[12px] text-[#6b6b76] font-sans text-right leading-tight">
          {version.pageCount != null && (
            <span>{version.pageCount} {version.pageCount === 1 ? "page" : "pages"}</span>
          )}
          {version.pageCount != null && version.wordCount != null && (
            <span className="mx-1.5">·</span>
          )}
          {version.wordCount != null && (
            <span>{version.wordCount.toLocaleString()} words</span>
          )}
        </div>
      )}

      <div className="flex items-center gap-0.5 shrink-0">
        <button
          onClick={() => console.log("View version", version.versionId)}
          className="px-2.5 py-1.5 text-[12px] font-sans text-[#6b6b76] rounded hover:text-indigo-400 transition-colors"
        >
          View
        </button>
        <button
          onClick={() => console.log("Restore version", version.versionId)}
          className="px-2.5 py-1.5 text-[12px] font-sans text-[#6b6b76] rounded hover:text-indigo-400 transition-colors"
        >
          Restore
        </button>
      </div>
    </div>
  );
}

// ─── Auto-saves tab ───────────────────────────────────────────────────────────

function AutosavesTab({
  snapshots,
  loading,
}: {
  snapshots: AutosaveSnapshot[];
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="text-[13px] text-[var(--color-fg-secondary)] font-sans">Loading…</div>
    );
  }

  if (snapshots.length === 0) {
    return (
      <div className="text-center py-8 text-[13px] text-[#6b6b76] font-sans">
        No auto-saves yet. They&apos;ll appear as you work.
      </div>
    );
  }

  const groups = groupByDate(snapshots);

  return (
    <>
      {groups.map((group) => (
        <div key={group.date} className="mb-4">
          <p
            className="text-[10px] font-sans font-semibold tracking-widest mb-1"
            style={{ color: "#4a4a58", letterSpacing: "0.1em" }}
          >
            {group.label}
          </p>
          {group.items.map((s) => (
            <AutosaveRow key={`${s.date}-${s.slot}`} snapshot={s} />
          ))}
        </div>
      ))}
    </>
  );
}

function AutosaveRow({ snapshot }: { snapshot: AutosaveSnapshot }) {
  return (
    <div
      className="flex items-center gap-4 py-3"
      style={{ borderBottom: "1px solid #1e1e28" }}
    >
      <div className="flex-1 min-w-0">
        <p className="text-white text-[13px] font-medium font-sans leading-tight">
          Slot {snapshot.slot} — {formatSlotTime(snapshot.createdAt)}
        </p>
        <p className="text-[#6b6b76] text-[11px] font-sans mt-0.5">
          {relativeTime(snapshot.createdAt)}
        </p>
      </div>

      <div className="flex items-center gap-0.5 shrink-0">
        <button
          onClick={() => console.log("View autosave", snapshot.date, snapshot.slot)}
          className="px-2.5 py-1.5 text-[12px] font-sans text-[#6b6b76] rounded hover:text-indigo-400 transition-colors"
        >
          View
        </button>
        <button
          onClick={() => console.log("Restore autosave", snapshot.date, snapshot.slot)}
          className="px-2.5 py-1.5 text-[12px] font-sans text-[#6b6b76] rounded hover:text-indigo-400 transition-colors"
        >
          Restore
        </button>
      </div>
    </div>
  );
}
